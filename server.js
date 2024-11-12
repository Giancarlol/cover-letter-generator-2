// Load environment variables first
require('dotenv').config();

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { handleWebhook } = require('./src/webhooks/stripeWebhook');

const app = express();

// Initialize AI models
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Language mapping for more readable names
const languageNames = {
  eng: 'English',
  spa: 'Spanish',
  swe: 'Swedish',
  // Add more languages as needed
};

// Trust proxy - MUST be set before any other middleware
app.set('trust proxy', 1);

const port = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: ['https://tailoredlettersai.com', 'https://www.tailoredlettersai.com'],
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

// Helper function to get letter count based on plan
const getLetterCountForPlan = (plan) => {
  switch (plan) {
    case 'Basic Plan':
      return 20;
    case 'Premium Plan':
      return 40;
    case 'Free Plan':
    default:
      return 5;
  }
};

// Helper function to generate cover letter using OpenAI
async function generateWithOpenAI(personalData, jobAd) {
  // Dynamically import franc
  const { franc } = await import('franc');
  
  // Detect the language of the job advertisement
  const detectedLangCode = franc(jobAd);
  const detectedLanguage = languageNames[detectedLangCode] || 'English'; // Default to English if detection fails

  const prompt = `You are an expert cover letter writer with extensive experience in professional recruitment and HR. Your task is to create a compelling, tailored cover letter that highlights the candidate's most relevant qualifications, skills, and accomplishments for this specific job.

The job advertisement is written in ${detectedLanguage}, so you MUST write the cover letter in ${detectedLanguage} as well.

Job Advertisement:
"${jobAd}"
  
Personal Information:
Name: ${personalData.name}
Studies: ${personalData.studies}
Experience: ${personalData.experiences.join(', ')}
  
Guidelines:
- Write the entire cover letter in ${detectedLanguage}
- Write in a professional yet engaging tone
- Emphasize the candidate's relevant skills and experiences that directly match the job requirements
- Show genuine enthusiasm and a clear understanding of the role and company
- Keep the letter concise, impactful, and focused on value-add
- Avoid clichés, generic statements, and overly formal language
- Where possible, include specific achievements, metrics, or examples
- Use proper business letter format
- Adapt the tone and style to reflect the company culture, as inferred from the job posting`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  return completion.choices[0].message.content;
}

// Helper function to generate cover letter using Gemini
async function generateWithGemini(personalData, jobAd) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  // Dynamically import franc
  const { franc } = await import('franc');
  
  // Detect the language of the job advertisement
  const detectedLangCode = franc(jobAd);
  const detectedLanguage = languageNames[detectedLangCode] || 'English'; // Default to English if detection fails
  
  const prompt = `You are an expert cover letter writer with extensive experience in professional recruitment and HR. Your task is to create a compelling, tailored cover letter that highlights the candidate's most relevant qualifications, skills, and accomplishments for this specific job.

The job advertisement is written in ${detectedLanguage}, so you MUST write the cover letter in ${detectedLanguage} as well.

Job Advertisement:
"${jobAd}"
  
Personal Information:
Name: ${personalData.name}
Studies: ${personalData.studies}
Experience: ${personalData.experiences.join(', ')}
  
Guidelines:
- Write the entire cover letter in ${detectedLanguage}
- Write in a professional yet engaging tone
- Emphasize the candidate's relevant skills and experiences that directly match the job requirements
- Show genuine enthusiasm and a clear understanding of the role and company
- Keep the letter concise, impactful, and focused on value-add
- Avoid clichés, generic statements, and overly formal language
- Where possible, include specific achievements, metrics, or examples
- Use proper business letter format
- Adapt the tone and style to reflect the company culture, as inferred from the job posting`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

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

// Endpoint to serve environment variables
app.get('/api/config', (req, res) => {
  res.json({
    VITE_STRIPE_PUBLISHABLE_KEY: process.env.VITE_STRIPE_PUBLISHABLE_KEY,
    VITE_API_BASE_URL: process.env.CLIENT_URL
  });
});

// Special raw body parsing for Stripe webhooks
app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    const result = await handleWebhook(req, endpointSecret, db, transporter);
    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create Stripe checkout session
app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { planName, planPrice } = req.body;
    const userEmail = req.user.email;

    if (!planName || !planPrice) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // First, try to find an existing customer or create a new one
    let customer;
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          planName,
          planPrice: planPrice.toString()
        }
      });
    }

    const baseUrl = process.env.CLIENT_URL;

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: {
        planName,
        planPrice: planPrice.toString(),
        userEmail: userEmail
      },
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

    console.log('Created checkout session:', {
      sessionId: session.id,
      customerId: customer.id,
      userEmail: userEmail
    });
    
    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message || 'Error creating checkout session' });
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
    const selectedPlan = 'Free Plan';
    const letterCount = getLetterCountForPlan(selectedPlan); // Set initial letter count based on Free Plan

    const result = await users.insertOne({
      name,
      email,
      password: hashedPassword,
      createdAt: new Date(),
      letterCount,
      selectedPlan
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

    // First check if user has any letters remaining
    const user = await users.findOne({ email: personalData.email });
    if (!user || user.letterCount <= 0) {
      return res.status(400).json({ message: 'No letters remaining. Please upgrade your plan.' });
    }

    let coverLetter;
    // Use different AI models based on the user's plan
    if (user.selectedPlan === 'Free Plan') {
      coverLetter = await generateWithGemini(personalData, jobAd);
    } else {
      // Basic and Premium plans use OpenAI
      coverLetter = await generateWithOpenAI(personalData, jobAd);
    }

    // Decrement the letter count
    await users.updateOne(
      { email: personalData.email },
      { $inc: { letterCount: -1 } }
    );

    res.status(200).json({ coverLetter });
  } catch (error) {
    console.error('Error generating cover letter:', error);
    res.status(500).json({ message: 'Error generating cover letter', error: error.message });
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

// Update plan status endpoint
app.post('/api/update-plan-status', authenticateToken, async (req, res) => {
  console.log('Updating plan status for user:', req.user.email);
  
  try {
    const { email } = req.user;
    const users = db.collection('users');

    // Get the latest payment session for this user
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

    console.log('Latest payment found:', latestPayment);

    if (latestPayment) {
      // Update the user with the latest payment information
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

    // Get and return the updated user data
    const userData = await users.findOne(
      { email }, 
      { projection: { password: 0 } }
    );

    console.log('Returning updated user data:', userData);
    res.status(200).json(userData);

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      message: 'Error updating plan status',
      details: error.message
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Export the app for testing
module.exports = app;
