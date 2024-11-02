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

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', req.body);
  }
  next();
});

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

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log('Rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      headers: req.headers
    });
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      details: 'Rate limit exceeded'
    });
  }
});

app.use(limiter);

// Additional rate limits for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log('Auth rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      headers: req.headers
    });
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      details: 'Authentication rate limit exceeded'
    });
  }
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

// Authentication middleware with detailed logging
const authenticateToken = (req, res, next) => {
  console.log('Authenticating request:', {
    path: req.path,
    method: req.method,
    headers: req.headers
  });

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ message: 'Authentication token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification failed:', err);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    console.log('Token verified successfully for user:', user);
    req.user = user;
    next();
  });
};

// Update plan status endpoint with detailed logging
app.post('/api/update-plan-status', authenticateToken, async (req, res) => {
  console.log('Received update-plan-status request');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  console.log('Authenticated user:', req.user);

  try {
    // Get email from either the authenticated user or request body
    const email = req.user.email || req.body.email;
    console.log('Processing update for email:', email);
    
    if (!email) {
      console.error('No email found in request');
      return res.status(400).json({ 
        message: 'Email is required',
        debug: {
          user: req.user,
          body: req.body
        }
      });
    }

    const users = db.collection('users');

    // First, check if the user exists and get their current data
    const user = await users.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(404).json({ 
        message: 'User not found',
        debug: { email }
      });
    }

    console.log('Found user:', user);

    // Get the latest payment for this user from the database
    const userWithPayment = await users.findOne(
      { 
        email,
        paymentStatus: 'completed'
      },
      { sort: { lastPaymentDate: -1 } }
    );

    if (!userWithPayment) {
      console.log('No completed payment found for user:', email);
      return res.status(404).json({ 
        message: 'No completed payment found',
        debug: { email, lastKnownStatus: user.paymentStatus }
      });
    }

    console.log('Found payment details:', userWithPayment);

    // Return the updated user data
    const updatedUser = await users.findOne({ email }, { projection: { password: 0 } });
    console.log('Returning updated user data:', updatedUser);
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      message: 'Error updating plan status',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Webhook endpoint with detailed logging
app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  console.log('Received webhook request');
  console.log('Webhook headers:', req.headers);
  
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('Webhook event constructed:', {
      type: event.type,
      id: event.id
    });
  } catch (err) {
    console.error('Webhook signature verification failed:', {
      error: err.message,
      signature: sig,
      body: req.body.toString()
    });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log('Processing payment intent:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      status: paymentIntent.status
    });
    
    try {
      const users = db.collection('users');
      const amount = paymentIntent.amount;
      const customerEmail = paymentIntent.receipt_email || paymentIntent.customer_email;
      
      if (!customerEmail) {
        console.error('No customer email in payment intent:', paymentIntent.id);
        return res.status(400).json({ error: 'No customer email found' });
      }

      console.log('Processing payment for customer:', customerEmail);

      let selectedPlan = 'Free Plan';
      let letterCount = 0;

      if (amount === 399) {
        selectedPlan = 'Basic Plan';
        letterCount = 5;
      } else if (amount === 999) {
        selectedPlan = 'Premium Plan';
        letterCount = 15;
      }

      console.log('Updating user plan:', { selectedPlan, letterCount });

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
      console.log('Confirmation email sent to:', customerEmail);
    } catch (error) {
      console.error('Error processing webhook:', {
        error: error.message,
        stack: error.stack
      });
      return res.status(500).json({ error: 'Error processing webhook' });
    }
  }

  res.json({received: true});
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    PORT: port,
    CLIENT_URL: process.env.CLIENT_URL
  });
});

// Export the app for testing
module.exports = app;
