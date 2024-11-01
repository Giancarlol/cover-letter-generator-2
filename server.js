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

// CORS configuration first - allow both CLIENT_URL and the Heroku app URL
app.use(cors({
  origin: [process.env.CLIENT_URL, 'https://tailored-letters-app-49dff41a7b95.herokuapp.com/'],
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

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log('Processing payment intent:', paymentIntent.id);
    
    try {
      const users = db.collection('users');

      // Get the payment details
      const amount = paymentIntent.amount;
      const customerEmail = paymentIntent.receipt_email || paymentIntent.customer_email;
      
      if (!customerEmail) {
        console.error('No customer email found in payment intent');
        return res.status(400).json({ error: 'No customer email found' });
      }

      console.log('Customer email:', customerEmail);

      let selectedPlan = 'Free Plan';
      let letterCount = 0;

      // Set plan based on payment amount (399 = $3.99, 999 = $9.99)
      if (amount === 399) {
        selectedPlan = 'Basic Plan';
        letterCount = 5;
      } else if (amount === 999) {
        selectedPlan = 'Premium Plan';
        letterCount = 15;
      }

      console.log('Updating user plan:', { selectedPlan, letterCount });

      // Update user with payment details
      const updateResult = await users.updateOne(
        { email: customerEmail },
        { 
          $set: { 
            selectedPlan,
            letterCount,
            paymentStatus: 'completed',
            lastPaymentDate: new Date(),
            stripePaymentIntentId: paymentIntent.id
          }
        }
      );

      console.log('User update result:', updateResult);

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
      console.log('Confirmation email sent');
    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).json({ error: 'Error processing webhook' });
    }
  }

  res.json({received: true});
});

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

// Update plan status endpoint
app.post('/api/update-plan-status', authenticateToken, async (req, res) => {
  console.log('Updating plan status for user:', req.user.email);
  
  try {
    const { email } = req.user;
    const users = db.collection('users');

    // First, check if the user exists and get their current data
    const user = await users.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Found user:', user);

    // Get the latest payment session for this user from the database
    const userWithSession = await users.findOne(
      { 
        email,
        paymentStatus: 'completed'
      },
      { sort: { lastPaymentDate: -1 } }
    );

    if (!userWithSession) {
      console.log('No completed payment found for user:', email);
      return res.status(404).json({ message: 'No completed payment found' });
    }

    console.log('Found payment session:', userWithSession);

    // Return the updated user data
    const updatedUser = await users.findOne({ email }, { projection: { password: 0 } });
    console.log('Returning updated user data:', updatedUser);
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

    // Get the base URL from the request
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: planName,
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

// Handle client-side routing - must be after API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Export the app for testing
module.exports = app;

//hshshsh
