import { MongoClient, Db } from 'mongodb';
import { User, CoverLetter } from '../types';

class MongoDB {
  private client: MongoClient;
  private db: Db;

  constructor() {
    const uri = import.meta.env.VITE_MONGODB_URI;
    if (!uri) {
      throw new Error('MongoDB URI is not set. Please set the VITE_MONGODB_URI environment variable.');
    }
    this.client = new MongoClient(uri);
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db('coverLetterGenerator');
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('Failed to connect to MongoDB', error);
      throw error;
    }
  }

  async insertUser(userData: User): Promise<{ insertedId: string }> {
    const collection = this.db.collection('users');
    const result = await collection.insertOne(userData);
    return { insertedId: result.insertedId.toString() };
  }

  async updateUser(email: string, update: Partial<User>): Promise<void> {
    const collection = this.db.collection('users');
    await collection.updateOne({ email }, { $set: update });
  }

  async insertCoverLetter(coverLetterData: CoverLetter): Promise<void> {
    const collection = this.db.collection('coverLetters');
    await collection.insertOne(coverLetterData);
  }

  async getUser(email: string): Promise<User | null> {
    const collection = this.db.collection('users');
    return collection.findOne({ email });
  }

  async close() {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }
}

const mongodb = new MongoDB();

export default mongodb;