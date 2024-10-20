const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // Use an environment variable in production
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  }
}

connectToDatabase();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Basic input validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const db = client.db('coverLetterGenerator');

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await db.collection('users').insertOne({
      name,
      email,
      password: hashedPassword,
      selectedPlan: 'Free Plan',
      letterCount: 0,
      studies: '',
      experiences: []
    });
    res.status(201).json({ message: 'User registered successfully', userId: result.insertedId });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Failed to register user' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = client.db('coverLetterGenerator');
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ 
      token, 
      user: { 
        name: user.name, 
        email: user.email, 
        selectedPlan: user.selectedPlan, 
        letterCount: user.letterCount,
        studies: user.studies,
        experiences: user.experiences
      } 
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Failed to login' });
  }
});

app.get('/api/check-auth', authenticateToken, async (req, res) => {
  try {
    const db = client.db('coverLetterGenerator');
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      name: user.name, 
      email: user.email, 
      selectedPlan: user.selectedPlan, 
      letterCount: user.letterCount,
      studies: user.studies,
      experiences: user.experiences
    });
  } catch (error) {
    console.error('Error checking authentication:', error);
    res.status(500).json({ message: 'Failed to check authentication' });
  }
});

app.put('/api/users/:email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;
    const updateData = req.body;
    const db = client.db('coverLetterGenerator');

    // Remove password from updateData if it exists
    if (updateData.password) {
      delete updateData.password;
    }

    await db.collection('users').updateOne({ email }, { $set: updateData });
    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

app.get('/api/users/:email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;
    const db = client.db('coverLetterGenerator');
    const user = await db.collection('users').findOne({ email }, { projection: { password: 0 } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Failed to fetch user data' });
  }
});

app.post('/api/generate-cover-letter', authenticateToken, async (req, res) => {
  try {
    const { personalData, jobAd } = req.body;
    const db = client.db('coverLetterGenerator');
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });

    if (user.selectedPlan === 'Free Plan' && user.letterCount >= 5) {
      return res.status(403).json({ message: 'You have reached the limit of 5 letters per month on the Free Plan. Please upgrade to generate more letters.' });
    }

    const prompt = `
      Generate a cover letter based on the following information:
      
      Personal Data:
      Name: ${personalData.name}
      Studies: ${personalData.studies}
      Experiences: ${personalData.experiences.join(', ')}

      Job Advertisement:
      ${jobAd}

      Please write a professional and engaging cover letter tailored to this job advertisement, highlighting the applicant's relevant skills and experiences.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    const coverLetter = completion.choices[0].message.content.trim();

    // Save the cover letter
    await db.collection('coverLetters').insertOne({
      userId: req.user.userId,
      jobAd,
      coverLetter,
      createdAt: new Date()
    });

    // Update user's letter count
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $inc: { letterCount: 1 } }
    );

    res.json({ coverLetter });
  } catch (error) {
    console.error('Error generating cover letter:', error);
    res.status(500).json({ message: 'Failed to generate cover letter' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
