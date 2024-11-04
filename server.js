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

// Trust proxy - MUST be set before any other middleware
app.set('trust proxy', 1);

const port = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: [process.env.CLIENT_URL, 'https://tailored-letters-app-49dff41a7b95.herokuapp.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Regular JSON parsing for all routes except webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

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

// Connect to MongoDB at startup
let db;
client.connect()
  .then(() => {
    console.log('Connected to MongoDB');
    db = client.db('coverLetterGenerator');
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });

// This is your Stripe CLI webhook secret for testing your endpoint locally.
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET;

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

// API Routes

// Special raw body parsing for Stripe webhooks
app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  console.log('Received webhook');

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('Webhook event type:', event.type);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle both payment_intent.succeeded and checkout.session.completed events
  if (event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed') {
    const paymentData = event.data.object;
    console.log('Processing payment data:', JSON.stringify(paymentData, null, 2));
    
    try {
      const users = db.collection('users');

      // Get the payment details
      const amount = paymentData.amount_total || paymentData.amount;
      const customerEmail = paymentData.customer_email || paymentData.receipt_email || paymentData.metadata?.userEmail;
      const planName = paymentData.metadata?.planName;
      
      if (!customerEmail) {
        console.error('No customer email found in payment data:', paymentData);
        return res.status(400).json({ error: 'No customer email found' });
      }

      console.log(`Processing payment for ${customerEmail} - Amount: ${amount}, Plan: ${planName}`);

      // Normalize amount to cents for comparison
      const amountInCents = Math.round(amount);
      let selectedPlan = 'Free Plan';
      let letterCount = 0;

      // Set plan based on exact amount in cents
      if (amountInCents === 399 || planName === 'Basic Plan') {
        selectedPlan = 'Basic Plan';
        letterCount = 20;
      } else if (amountInCents === 999 || planName === 'Premium Plan') {
        selectedPlan = 'Premium Plan';
        letterCount = 40;
      }

      console.log(`Determined plan details - Plan: ${selectedPlan}, Letters: ${letterCount}`);

      // Update user with payment details
      const updateResult = await users.updateOne(
        { email: customerEmail },
        { 
          $set: { 
            selectedPlan,
            letterCount,
            paymentStatus: 'completed',
            lastPaymentDate: new Date(),
            stripePaymentId: paymentData.id,
            lastPaymentAmount: amountInCents
          }
        }
      );

      if (!updateResult.matchedCount) {
        console.error(`No user found with email ${customerEmail}`);
        return res.status(404).json({ error: 'User not found' });
      }

      console.log(`User update successful - Modified: ${updateResult.modifiedCount}`);

      // Get updated user data to verify the change
      const updatedUser = await users.findOne({ email: customerEmail });
      console.log('Updated user data:', JSON.stringify(updatedUser, null, 2));

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
      console.log('Confirmation email sent successfully');
    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).json({ error: 'Error processing webhook', details: error.message });
    }
  }

  res.json({received: true});
});

// Update plan status endpoint
app.post('/api/update-plan-status', authenticateToken, async (req, res) => {
  console.log('Updating plan status for user:', req.user.email);
  
  try {
    const { email } = req.user;
    const users = db.collection('users');

    // Find the most recent completed payment for non-free plans
    const user = await users.findOne(
      { 
        email,
        paymentStatus: 'completed',
        selectedPlan: { $ne: 'Free Plan' }
      },
      { 
        sort: { lastPaymentDate: -1 },
        projection: { password: 0 }
      }
    );

    console.log('Found payment data:', user ? JSON.stringify(user, null, 2) : 'No payment found');

    if (!user) {
      // If no payment found, return current user data with free plan
      const currentUser = await users.findOne(
        { email },
        { projection: { password: 0 } }
      );
      
      // Ensure free plan settings if no payment found
      if (currentUser) {
        await users.updateOne(
          { email },
          { 
            $set: { 
              selectedPlan: 'Free Plan',
              letterCount: 0
            }
          }
        );
        currentUser.selectedPlan = 'Free Plan';
        currentUser.letterCount = 0;
      }
      
      console.log('Returning current user data:', JSON.stringify(currentUser, null, 2));
      return res.status(200).json(currentUser);
    }

    // Update the user with the payment information
    const updateResult = await users.updateOne(
      { email },
      { 
        $set: { 
          selectedPlan: user.selectedPlan,
          letterCount: user.letterCount,
          lastPaymentDate: user.lastPaymentDate,
          paymentStatus: 'completed'
        }
      }
    );

    console.log('Update result:', JSON.stringify(updateResult, null, 2));

    // Get and return the updated user data
    const updatedUser = await users.findOne(
      { email },
      { projection: { password: 0 } }
    );

    console.log('Returning updated user data:', JSON.stringify(updatedUser, null, 2));
    res.status(200).json(updatedUser);

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      message: 'Error updating plan status',
      details: error.message
    });
  }
});

// Registration endpoint
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
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

// Stripe checkout session endpoint
app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { planName, planPrice } = req.body;

    if (!planName || !planPrice) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Creating checkout session for:', { planName, planPrice, email: req.user.email });

    // Get the base URL from the request
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: req.user.email,
      metadata: {
        planName,
        userEmail: req.user.email
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: planName,
              metadata: {
                planType: planName
              }
            },
            unit_amount: planPrice,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/success`,
      cancel_url: `${baseUrl}`,
    });

    console.log('Created checkout session:', session.id);
    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Error creating checkout session' });
  }
});

// Serve static files - AFTER all API routes
app.use(express.static(path.join(__dirname, 'dist')));

// Handle client-side routing - LAST route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Export the app for testing
module.exports = app;
