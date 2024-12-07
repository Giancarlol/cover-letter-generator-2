import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { login } from '../utils/api';
import type { PersonalData } from '../utils/api';

interface LoginProps {
  onLogin: (user: PersonalData) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isResetRequested, setIsResetRequested] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await login(email, password);
      onLogin(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      setIsResetRequested(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while requesting password reset');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
          AI Cover Letter Generator
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Create professional, personalized cover letters in minutes. Stand out from the crowd and increase your chances of landing your dream job.
        </p>
      </div>

      {/* Login Form */}
      <div className="max-w-md w-full mx-auto bg-white p-8 rounded-lg shadow-md mb-12">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Sign in to get started</h2>
        </div>
        
        {isResetRequested ? (
          <div className="rounded-md bg-green-50 p-4" role="alert">
            <div className="text-sm text-green-700">
              If an account exists with that email, you will receive password reset instructions shortly.
            </div>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit} aria-label="Sign in form">
            {error && (
              <div className="rounded-md bg-red-50 p-4" role="alert">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
            
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Forgot your password?
              </button>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign in
            </button>
          </form>
        )}
        
        <div className="mt-6 text-center">
          <Link
            to="/register"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Don't have an account? Register now
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Quick & Easy</h2>
          <p className="text-gray-600 text-center">Generate tailored cover letters in minutes using our AI-powered platform.</p>
        </div>
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Professional Quality</h2>
          <p className="text-gray-600 text-center">Get expertly crafted cover letters that highlight your unique skills and experience.</p>
        </div>
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Job-Specific</h2>
          <p className="text-gray-600 text-center">Customize your letter based on the job description for better targeting.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
