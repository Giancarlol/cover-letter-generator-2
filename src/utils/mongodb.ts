import { User, CoverLetter } from '../types';

class MockMongoDB {
  private users: User[] = [];
  private coverLetters: CoverLetter[] = [];

  async insertUser(userData: User): Promise<{ insertedId: string }> {
    this.users.push(userData);
    return { insertedId: userData.email };
  }

  async updateUser(email: string, update: Partial<User>): Promise<void> {
    const userIndex = this.users.findIndex(user => user.email === email);
    if (userIndex !== -1) {
      this.users[userIndex] = { ...this.users[userIndex], ...update };
    }
  }

  async insertCoverLetter(coverLetterData: CoverLetter): Promise<void> {
    this.coverLetters.push(coverLetterData);
  }

  async getUser(email: string): Promise<User | null> {
    return this.users.find(user => user.email === email) || null;
  }
}

class RealMongoDB {
  async insertUser(userData: User): Promise<{ insertedId: string }> {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return response.json();
  }

  async updateUser(email: string, update: Partial<User>): Promise<void> {
    await fetch(`/api/users/${email}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
  }

  async insertCoverLetter(coverLetterData: CoverLetter): Promise<void> {
    await fetch('/api/cover-letters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coverLetterData),
    });
  }

  async getUser(email: string): Promise<User | null> {
    const response = await fetch(`/api/users/${email}`);
    if (response.ok) {
      return response.json();
    }
    return null;
  }
}

const isProduction = import.meta.env.PROD;
const MongoDB = isProduction ? new RealMongoDB() : new MockMongoDB();

export default MongoDB;