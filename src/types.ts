export interface User {
  email: string;
  name: string;
  selectedPlan: string;
  letterCount: number;
  personalData?: any;
}

export interface CoverLetter {
  userId: string;
  jobAd: string;
  coverLetter: string;
  createdAt: Date;
}