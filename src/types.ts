export interface User {
  username: string;
  email: string;
  password: string; // Note: In a real production environment, never store plain text passwords
  studies: string;
  experiences: string[];
  selectedPlan: string;
  letterCount: number;
}

export interface CoverLetter {
  userId: string;
  jobAd: string;
  coverLetter: string;
  createdAt: Date;
}