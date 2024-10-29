// Default to production URL if environment variable is not set
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://tailored-letters-app-49dff41a7b95.herokuapp.com';

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

export interface RegistrationResponse {
  message: string;
  userId: string;
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
  const contentType = response.headers.get('content-type');
  if (!response.ok) {
    const errorData = contentType?.includes('application/json') 
      ? await response.json()
      : { message: 'An error occurred' };
    throw new Error(errorData.message || 'An error occurred');
  }
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: mergeHeaders({}),
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse(response);
    setAuthToken(data.token);
    
    // Fetch fresh user data after login
    const userData = await getUser(email);
    return {
      token: data.token,
      user: userData
    };
  } catch (error) {
    clearAuthToken();
    throw error;
  }
};

export const logout = () => {
  clearAuthToken();
};

export const registerUser = async (userData: RegistrationData): Promise<RegistrationResponse> => {
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

export const requestPasswordReset = async (email: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/reset-password`, {
    method: 'POST',
    headers: mergeHeaders({}),
    body: JSON.stringify({ email }),
  });
  return handleResponse(response);
};

export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/reset-password/confirm`, {
    method: 'POST',
    headers: mergeHeaders({}),
    body: JSON.stringify({ token, newPassword }),
  });
  return handleResponse(response);
};

export const refreshUserData = async (): Promise<PersonalData | null> => {
  try {
    return await checkAuth();
  } catch (error) {
    console.error('Error refreshing user data:', error);
    return null;
  }
};
