// Load environment variables first
require('dotenv').config();

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');
const rateLimit = require('express-rate-limit');

// Initialize Stripe with the secret key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Log environment check (remove in production)
console.log('Environment Check:', {
  stripeKey: !!process.env.STRIPE_SECRET_KEY,
  port: process.env.PORT || 3001,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:4179'
});

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:4179', 'http://localhost:5173', 'http://localhost:4177'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// This is your Stripe CLI webhook secret for testing your endpoint locally.
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.use(express.json({
  verify: function(req, res, buf) {
    if (req.originalUrl.startsWith('/api/webhook')) {
      req.rawBody = buf.toString();
    }
  }
}));

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
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
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

// Stripe checkout session endpoint
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { planName, planPrice } = req.body;
    console.log('Creating checkout session for:', { planName, planPrice });

    if (!planName || !planPrice) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
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
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/success`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}`,
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to verify MongoDB connection and users collection
app.get('/api/test-db', async (req, res) => {
  try {
    const db = client.db('coverLetterGenerator');
    const users = db.collection('users');
    const count = await users.countDocuments();
    res.json({ message: 'Database connection successful', userCount: count });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ message: 'Database connection error', error: error.message });
  }
});

// Registration endpoint with debug logging
app.post('/api/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    const { name, email, password } = req.body;
    const db = client.db('coverLetterGenerator');
    const users = db.collection('users');

    console.log('Checking for existing user with email:', email);
    // Check if user already exists
    const existingUser = await users.findOne({ email });
    console.log('Existing user check result:', existingUser);

    if (existingUser) {
      console.log('User already exists with email:', email);
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const result = await users.insertOne({
      name,
      email,
      password: hashedPassword,
      createdAt: new Date(),
      letterCount: 0,
      selectedPlan: 'Free Plan'
    });

    console.log('User successfully registered:', result.insertedId);

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertedId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
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
    console.error('Login error:', error);
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
    console.error('Update user error:', error);
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
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Error retrieving user information' });
  }
});

// Generate cover letter
app.post('/api/generate-cover-letter', authenticateToken, async (req, res) => {
  try {
    const { personalData, jobAd } = req.body;
    const db = client.db('coverLetterGenerator');
    const users = db.collection('users');

    // Simple cover letter generation (replace with actual OpenAI implementation)
    const coverLetter = `Dear Hiring Manager,\n\nI am writing to express my interest in the position...\n\nBest regards,\n${personalData.name}`;

    // Update letter count
    await users.updateOne(
      { email: personalData.email },
      { $inc: { letterCount: 1 } }
    );

    res.status(200).json({ coverLetter });
  } catch (error) {
    console.error('Cover letter generation error:', error);
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
    console.error('Auth check error:', error);
    res.status(500).json({ message: 'Error checking authentication status' });
  }
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
