const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');
const rateLimit = require('express-rate-limit');
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

// ... (rest of the code remains the same)

// Move the app.listen call to a separate function
const startServer = () => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

// Only start the server if this file is run directly
if (require.main === module) {
  startServer();
}

// Export the app for testing
module.exports = app;
