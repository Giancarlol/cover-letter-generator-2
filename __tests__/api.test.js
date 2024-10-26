const request = require('supertest');
const { MongoClient } = require('mongodb');
const app = require('../server');
const jwt = require('jsonwebtoken');

describe('API Endpoints', () => {
  let connection;
  let db;
  let server;
  let token;

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = await connection.db('coverLetterGenerator');
    server = app.listen(3001);
  });

  afterAll(async () => {
    await connection.close();
    await server.close();
    // Add a small delay to ensure connections are properly closed
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  beforeEach(async () => {
    // Clear the database before each test
    await db.collection('users').deleteMany({});
    token = jwt.sign({ email: 'test@example.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  describe('User Registration and Login', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'User registered successfully');
      expect(res.body).toHaveProperty('userId');
    });

    it('should not register a user with an existing email', async () => {
      await request(app)
        .post('/api/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      const res = await request(app)
        .post('/api/register')
        .send({
          name: 'Another Test User',
          email: 'test@example.com',
          password: 'anotherpassword'
        });
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'User with this email already exists');
    });

    it('should login a user with correct credentials', async () => {
      await request(app)
        .post('/api/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
    });

    it('should not login a user with incorrect credentials', async () => {
      await request(app)
        .post('/api/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'Invalid email or password');
    });
  });

  describe('User Operations', () => {
    it('should update user information', async () => {
      await request(app)
        .post('/api/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      const res = await request(app)
        .put('/api/users/test@example.com')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Test User',
          studies: 'Computer Science',
          experiences: ['Software Developer', 'Web Designer']
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'User updated successfully');
    });

    it('should get user information', async () => {
      await request(app)
        .post('/api/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      const res = await request(app)
        .get('/api/users/test@example.com')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('name', 'Test User');
      expect(res.body).toHaveProperty('email', 'test@example.com');
    });
  });

  describe('Cover Letter Generation', () => {
    it('should generate a cover letter', async () => {
      await request(app)
        .post('/api/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      const res = await request(app)
        .post('/api/generate-cover-letter')
        .set('Authorization', `Bearer ${token}`)
        .send({
          personalData: {
            name: 'Test User',
            email: 'test@example.com',
            studies: 'Computer Science',
            experiences: ['Software Developer', 'Web Designer'],
            selectedPlan: 'basic',
            letterCount: 0
          },
          jobAd: 'We are looking for a skilled software developer...'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('coverLetter');
      expect(typeof res.body.coverLetter).toBe('string');
    });
  });

  describe('Authentication', () => {
    it('should check authentication status', async () => {
      await request(app)
        .post('/api/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      const res = await request(app)
        .get('/api/check-auth')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('name', 'Test User');
      expect(res.body).toHaveProperty('email', 'test@example.com');
    });

    it('should return 401 for invalid token', async () => {
      const res = await request(app)
        .get('/api/check-auth')
        .set('Authorization', 'Bearer invalidtoken');

      expect(res.statusCode).toEqual(401);
    });
  });
});
