// Load environment variables first
require('dotenv').config();

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');

// Initialize Stripe with the secret key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 3001;

// Trust proxy - required for rate limiting behind reverse proxies (like Heroku)
app.set('trust proxy', 1);

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// Additional rate limits for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5 // limit each IP to 5 requests per windowMs
});

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// This is your Stripe CLI webhook secret for testing your endpoint locally.
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Special raw body parsing for Stripe webhooks
app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      
      try {
        // Get customer email from session
        const customer = await stripe.customers.retrieve(session.customer);
        const customerEmail = customer.email;

        // Update user in database
        const db = client.db('coverLetterGenerator');
        const users = db.collection('users');

        // Get the payment amount to determine the plan
        const amount = session.amount_total;
        let selectedPlan = 'Free Plan';
        let letterCount = 0;

        // Set plan based on payment amount
        if (amount === 999) { // $9.99
          selectedPlan = 'Basic Plan';
          letterCount = 5;
        } else if (amount === 1999) { // $19.99
          selectedPlan = 'Premium Plan';
          letterCount = 15;
        }

        await users.updateOne(
          { email: customerEmail },
          { 
            $set: { 
              selectedPlan,
              letterCount,
              paymentStatus: 'completed',
              lastPaymentDate: new Date(),
              stripeSessionId: session.id  // Store the session ID for reference
            }
          }
        );

        // Send confirmation email
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: customerEmail,
          subject: 'Payment Confirmation - Cover Letter Generator',
          html: `
            <h1>Thank you for your purchase!</h1>
            <p>Your payment has been successfully processed.</p>
            <p>Plan: ${selectedPlan}</p>
            <p>Available letter generations: ${letterCount}</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
          `
        };

        await transporter.sendMail(mailOptions);
      } catch (error) {
        console.error('Error processing webhook:', error);
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object;
      try {
        // Get customer email
        const customer = await stripe.customers.retrieve(paymentIntent.customer);
        const customerEmail = customer.email;

        // Send failure notification
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: customerEmail,
          subject: 'Payment Failed - Cover Letter Generator',
          html: `
            <h1>Payment Failed</h1>
            <p>We were unable to process your payment. Please try again or contact support if the issue persists.</p>
          `
        };

        await transporter.sendMail(mailOptions);
      } catch (error) {
        console.error('Error processing payment failure:', error);
      }
      break;
    }
  }

  res.json({received: true});
});

// Regular JSON parsing for all other routes
app.use(express.json());

// MongoDB connection
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('Error: MONGODB_URI is not defined in your environment variables.');
  process.exit(1);
}

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// JWT and OpenAI configuration
const JWT_SECRET = process.env.JWT_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Update plan status endpoint
app.post('/api/update-plan-status', authenticateToken, async (req, res) => {
  try {
    const { email } = req.user;
    const db = client.db('coverLetterGenerator');
    const users = db.collection('users');

    // First, check if the user exists and get their current data
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    try {
      // Get the latest payment session for this user from the database
      const userWithSession = await users.findOne(
        { 
          email,
          stripeSessionId: { $exists: true },
          paymentStatus: 'completed'
        },
        { sort: { lastPaymentDate: -1 } }
      );

      if (!userWithSession) {
        return res.status(404).json({ message: 'No completed payment found' });
      }

      // Verify the session with Stripe
      const session = await stripe.checkout.sessions.retrieve(userWithSession.stripeSessionId);
      
      if (!session || session.status !== 'complete') {
        return res.status(400).json({ message: 'Invalid or incomplete payment session' });
      }

      const amount = session.amount_total;
      let selectedPlan = 'Free Plan';
      let letterCount = 0;

      // Set plan based on payment amount
      if (amount === 999) { // $9.99
        selectedPlan = 'Basic Plan';
        letterCount = 5;
      } else if (amount === 1999) { // $19.99
        selectedPlan = 'Premium Plan';
        letterCount = 15;
      }

      // Update user with plan details
      await users.updateOne(
        { email },
        { 
          $set: { 
            selectedPlan,
            letterCount,
            paymentStatus: 'completed',
            lastPaymentDate: new Date()
          }
        }
      );

      const updatedUser = await users.findOne({ email }, { projection: { password: 0 } });
      res.status(200).json(updatedUser);
    } catch (stripeError) {
      console.error('Stripe API Error:', stripeError);
      res.status(500).json({ 
        message: 'Error verifying payment with Stripe',
        details: stripeError.message
      });
    }
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      message: 'Error updating plan status',
      details: error.message
    });
  }
});

// Password reset request endpoint
app.post('/api/reset-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const db = client.db('coverLetterGenerator');
    const users = db.collection('users');

    const user = await users.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: 'If an account exists with that email, you will receive password reset instructions shortly.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    await users.updateOne(
      { email },
      {
        $set: {
          resetToken,
          resetTokenExpiry
        }
      }
    );

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset for your Cover Letter Generator account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this reset, you can safely ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: 'If an account exists with that email, you will receive password reset instructions shortly.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing password reset request' });
  }
});

// Password reset confirmation endpoint
app.post('/api/reset-password/confirm', authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const db = client.db('coverLetterGenerator');
    const users = db.collection('users');

    const user = await users.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await users.updateOne(
      { _id: user._id },
      {
        $set: { password: hashedPassword },
        $unset: { resetToken: "", resetTokenExpiry: "" }
      }
    );

    res.status(200).json({ message: 'Password successfully reset' });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// Stripe checkout session endpoint
app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { planName, planPrice } = req.body;

    if (!planName || !planPrice) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get the base URL from the request
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: req.user.email, // Add customer email for webhook processing
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: planName,
            },
            unit_amount: planPrice * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/success`,
      cancel_url: `${baseUrl}`,
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: 'Error creating checkout session' });
  }
});

// Registration endpoint
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const db = client.db('coverLetterGenerator');
    const users = db.collection('users');

    const existingUser = await users.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await users.insertOne({
      name,
      email,
      password: hashedPassword,
      createdAt: new Date(),
      letterCount: 0,
      selectedPlan: 'Free Plan'
    });

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertedId
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Login endpoint
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = client.db('coverLetterGenerator');
    const users = db.collection('users');

    const user = await users.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    
    res.status(200).json({
      token,
      user: {
        name: user.name,
        email: user.email,
        selectedPlan: user.selectedPlan,
        letterCount: user.letterCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Update user information
app.put('/api/users/:email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;
    const updateData = req.body;
    const db = client.db('coverLetterGenerator');
    const users = db.collection('users');

    await users.updateOne(
      { email },
      { $set: updateData }
    );

    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Get user information
app.get('/api/users/:email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;
    const db = client.db('coverLetterGenerator');
    const users = db.collection('users');

    const user = await users.findOne({ email }, { projection: { password: 0 } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving user information' });
  }
});

// Generate cover letter
app.post('/api/generate-cover-letter', authenticateToken, async (req, res) => {
  try {
    const { personalData, jobAd } = req.body;
    const db = client.db('coverLetterGenerator');
    const users = db.collection('users');

    const coverLetter = `Dear Hiring Manager,\n\nI am writing to express my interest in the position...\n\nBest regards,\n${personalData.name}`;

    await users.updateOne(
      { email: personalData.email },
      { $inc: { letterCount: 1 } }
    );

    res.status(200).json({ coverLetter });
  } catch (error) {
    res.status(500).json({ message: 'Error generating cover letter' });
  }
});

// Check authentication status
app.get('/api/check-auth', authenticateToken, async (req, res) => {
  try {
    const db = client.db('coverLetterGenerator');
    const users = db.collection('users');

    const user = await users.findOne({ email: req.user.email }, { projection: { password: 0 } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error checking authentication status' });
  }
});

// Handle client-side routing - must be after API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Function to start the server
const startServer = async () => {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

// Only start the server if this file is run directly
if (require.main === module) {
  startServer();
}

// Export the app for testing
module.exports = app;
