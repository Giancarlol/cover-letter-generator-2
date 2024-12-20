declare global {
  interface Window {
    env: {
      VITE_STRIPE_PUBLISHABLE_KEY: string;
      VITE_API_BASE_URL: string;
    };
  }
}

// Use relative path for API requests
export const API_BASE_URL = '/api';

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
  subscriptionEndDate?: string;
}

export interface LoginResponse {
  token: string;
  user: PersonalData;
}

export interface RegistrationResponse {
  message: string;
  userId: string;
}

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

// Retrieve token from localStorage each time to ensure latest state
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('authToken'); // Always fetch token directly from localStorage
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Store the token in both the variable and localStorage
const setAuthToken = (token: string) => {
  localStorage.setItem('authToken', token);
};

// Clear the token from both localStorage and variable
export const clearAuthToken = () => {
  localStorage.removeItem('authToken');
};

// Merge headers with Content-Type and Authorization
const mergeHeaders = (headers: Record<string, string>): HeadersInit => {
  return {
    ...headers,
    'Content-Type': 'application/json',
  };
};

// Handle the API response, checking for JSON content and handling errors
const handleResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  if (!response.ok) {
    console.error('API Error Response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url
    });
    
    let errorData;
    try {
      errorData = contentType?.includes('application/json') ? await response.json() : await response.text();
      console.error('Error Response Data:', errorData);
    } catch (e) {
      console.error('Error parsing response:', e);
      errorData = { message: 'Failed to parse error response' };
    }
    
    throw new Error(
      typeof errorData === 'object' ? errorData.message || JSON.stringify(errorData) : errorData || 'An error occurred'
    );
  }
  return contentType?.includes('application/json') ? response.json() : response.text();
};

// Submit contact form
export const submitContactForm = async (formData: ContactFormData): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/contact`, {
    method: 'POST',
    headers: mergeHeaders({}),
    body: JSON.stringify(formData),
  });
  return handleResponse(response);
};

// Login function with token storage and user data fetching
export const login = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
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

// Logout by clearing the token
export const logout = () => {
  clearAuthToken();
};

// Register a user
export const registerUser = async (userData: RegistrationData): Promise<RegistrationResponse> => {
  const response = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: mergeHeaders({}),
    body: JSON.stringify(userData),
  });
  return handleResponse(response);
};

// Update user data with authorization
export const updateUser = async (email: string, updateData: Partial<PersonalData>) => {
  const response = await fetch(`${API_BASE_URL}/users/${email}`, {
    method: 'PUT',
    headers: mergeHeaders(getAuthHeaders()),
    body: JSON.stringify(updateData),
  });
  return handleResponse(response);
};

// Get user data with authorization
export const getUser = async (email: string): Promise<PersonalData> => {
  const response = await fetch(`${API_BASE_URL}/users/${email}`, {
    headers: mergeHeaders(getAuthHeaders()),
  });
  return handleResponse(response);
};

// Generate cover letter with authorization
export const generateCoverLetter = async (personalData: PersonalData, jobAd: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/generate-cover-letter`, {
    method: 'POST',
    headers: mergeHeaders(getAuthHeaders()),
    body: JSON.stringify({ personalData, jobAd }),
  });
  const data = await handleResponse(response);
  return data.coverLetter;
};

// Check authentication by verifying token
export const checkAuth = async (): Promise<PersonalData | null> => {
  const token = localStorage.getItem('authToken');
  if (!token) {
    return null;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/check-auth`, {
      headers: mergeHeaders(getAuthHeaders()),
    });
    return handleResponse(response);
  } catch (error) {
    console.error('Error checking authentication:', error);
    clearAuthToken();
    return null;
  }
};

// Request password reset
export const requestPasswordReset = async (email: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/reset-password`, {
    method: 'POST',
    headers: mergeHeaders({}),
    body: JSON.stringify({ email }),
  });
  return handleResponse(response);
};

// Reset password
export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/reset-password/confirm`, {
    method: 'POST',
    headers: mergeHeaders({}),
    body: JSON.stringify({ token, newPassword }),
  });
  return handleResponse(response);
};

// Refresh user data after updating the plan status
export const refreshUserData = async (): Promise<PersonalData | null> => {
  try {
    const currentUser = await checkAuth();
    
    if (!currentUser) {
      return null;
    }

    const headers = getAuthHeaders();

    // Update the user's plan status on the server
    const response = await fetch(`${API_BASE_URL}/update-plan-status`, {
      method: 'POST',
      headers: mergeHeaders(headers),
      body: JSON.stringify({ email: currentUser.email }),
    });

    await handleResponse(response);

    // Get the fresh user data after plan update
    const updatedUser = await getUser(currentUser.email);
    return updatedUser;
  } catch (error) {
    console.error('Error in refreshUserData:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    return null;
  }
};
