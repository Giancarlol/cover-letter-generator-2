export interface User {
  email: string;
  name: string;
  selectedPlan: string;
  letterCount: number;
  studies: string;
  experiences: string[];
}

export interface CoverLetterData {
  userId: string;
  jobAd: string;
  coverLetter: string;
  createdAt: Date;
}