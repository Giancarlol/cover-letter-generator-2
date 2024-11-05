require('dotenv').config();

const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const webhookHandler = require('./src/webhooks/stripeWebhook');

const app = express();

app.set('trust proxy', 1);

const port = process.env.PORT || 3001;

app.use(cors({
  origin: [process.env.CLIENT_URL, 'https://tailored-letters-app-49dff41a7b95.herokuapp.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('Error: MONGODB_URI is not defined in your environment variables.');
  process.exit(1);
}

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

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

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const JWT_SECRET = process.env.JWT_SECRET;

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

app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    const result = await webhookHandler.handleWebhook(req, endpointSecret, db, transporter);
    res.json({ received: true, ...result });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ 
      error: error.message || 'Webhook Error',
      details: error.stack
    });
  }
});

app.post('/api/update-plan-status', authenticateToken, async (req, res) => {
  try {
    const { email } = req.user;
    const users = db.collection('users');

    const latestPayment = await users.findOne(
      { 
        email,
        paymentStatus: 'completed'
      },
      { 
        sort: { lastPaymentDate: -1 },
        projection: { selectedPlan: 1, letterCount: 1, lastPaymentDate: 1 }
      }
    );

    if (latestPayment) {
      await users.updateOne(
        { email },
        { 
          $set: { 
            selectedPlan: latestPayment.selectedPlan,
            letterCount: latestPayment.letterCount,
            lastPaymentDate: latestPayment.lastPaymentDate
          }
        }
      );
    }

    const userData = await users.findOne(
      { email }, 
      { projection: { password: 0 } }
    );

    res.status(200).json(userData);

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      message: 'Error updating plan status',
      details: error.message
    });
  }
});

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

app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { planName, planPrice } = req.body;

    if (!planName || !planPrice) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

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

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;