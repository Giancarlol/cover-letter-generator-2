const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export interface RegistrationData {
  name: string;
  email: string;
  password: string;
}

export interface PersonalData {
  email: string;
  name: string;
  studies: string;
  experiences: string[];
  selectedPlan: string;
  letterCount: number;
}

export interface LoginResponse {
  token: string;
  user: PersonalData;
}

let authToken: string | null = localStorage.getItem('authToken');

const setAuthToken = (token: string) => {
  authToken = token;
  localStorage.setItem('authToken', token);
};

export const clearAuthToken = () => {
  authToken = null;
  localStorage.removeItem('authToken');
};

const getAuthHeaders = (): Record<string, string> => {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
};

const mergeHeaders = (headers: Record<string, string>): HeadersInit => {
  return {
    ...headers,
    'Content-Type': 'application/json',
  };
};

const handleResponse = async (response: Response) => {
  if (response.status === 401) {
    clearAuthToken();
    throw new Error('Your session has expired. Please log in again.');
  }
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'An error occurred');
  }
  return response.json();
};

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: mergeHeaders({}),
    body: JSON.stringify({ email, password }),
  });
  const data = await handleResponse(response);
  setAuthToken(data.token);
  return data;
};

export const logout = () => {
  clearAuthToken();
};

export const registerUser = async (userData: RegistrationData) => {
  const response = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: mergeHeaders({}),
    body: JSON.stringify(userData),
  });
  return handleResponse(response);
};

export const updateUser = async (email: string, updateData: Partial<PersonalData>) => {
  const response = await fetch(`${API_BASE_URL}/api/users/${email}`, {
    method: 'PUT',
    headers: mergeHeaders(getAuthHeaders()),
    body: JSON.stringify(updateData),
  });
  return handleResponse(response);
};

export const getUser = async (email: string): Promise<PersonalData> => {
  const response = await fetch(`${API_BASE_URL}/api/users/${email}`, {
    headers: mergeHeaders(getAuthHeaders()),
  });
  return handleResponse(response);
};

export const generateCoverLetter = async (personalData: PersonalData, jobAd: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/generate-cover-letter`, {
    method: 'POST',
    headers: mergeHeaders(getAuthHeaders()),
    body: JSON.stringify({ personalData, jobAd }),
  });
  const data = await handleResponse(response);
  return data.coverLetter;
};

export const checkAuth = async (): Promise<PersonalData | null> => {
  if (!authToken) {
    return null;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/check-auth`, {
      headers: mergeHeaders(getAuthHeaders()),
    });
    return handleResponse(response);
  } catch (error) {
    console.error('Error checking authentication:', error);
    clearAuthToken();
    return null;
  }
};
