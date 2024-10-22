const request = require('supertest');
const { MongoClient } = require('mongodb');
const app = require('../server');

describe('API Endpoints', () => {
  let connection;
  let db;

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = await connection.db('coverLetterGenerator');
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
  });

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
    expect(res.body).toHaveProperty('message', 'Invalid password');
  });
});
