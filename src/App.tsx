import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Elements } from '@stripe/stripe-react';
import { loadStripe } from '@stripe/stripe-js';
import Login from './components/Login';
import RegistrationForm from './components/RegistrationForm';
import JobAdForm from './components/JobAdForm';
import PersonalDataForm from './components/PersonalDataForm';
import PaymentPlanSelection from './components/PaymentPlanSelection';
import PaymentSuccess from './components/PaymentSuccess';
import ResetPassword from './components/ResetPassword';
import { checkAuth, clearAuthToken, registerUser } from './utils/api';
import type { PersonalData, RegistrationData } from './utils/api';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userData, setUserData] = useState<PersonalData | null>(null);
  const [showPaymentPlan, setShowPaymentPlan] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      const user = await checkAuth();
      if (user) {
        setIsAuthenticated(true);
        setUserData(user);
      }
    };
    verifyAuth();
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    setIsAuthenticated(false);
    setUserData(null);
  };

  const handleLogin = (user: PersonalData) => {
    setIsAuthenticated(true);
    setUserData(user);
  };

  const handleRegister = async (userData: RegistrationData) => {
    try {
      // The registration endpoint returns { message: string, userId: string }
      const response = await registerUser(userData);
      // After successful registration, we should log the user in
      if (response.userId) {
        // Create a PersonalData object from the registration data
        const user: PersonalData = {
          name: userData.name,
          email: userData.email,
          studies: '',
          experiences: [],
          selectedPlan: 'Free Plan',
          letterCount: 0
        };
        setIsAuthenticated(true);
        setUserData(user);
      }
    } catch (error) {
      // Re-throw the error so the RegistrationForm can handle it
      throw error;
    }
  };

  const handleSelectPlan = (plan: string) => {
    if (userData) {
      setUserData({ ...userData, selectedPlan: plan });
    }
    setShowPaymentPlan(false);
  };

  return (
    <Elements stripe={stripePromise}>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-xl font-bold text-gray-900">Cover Letter Generator</h1>
                </div>
              </div>
              {isAuthenticated && (
                <div className="flex items-center">
                  <button
                    onClick={() => setShowPaymentPlan(true)}
                    className="mr-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Plans
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {showPaymentPlan && userData && (
            <PaymentPlanSelection
              onSelectPlan={handleSelectPlan}
              onClose={() => setShowPaymentPlan(false)}
              selectedPlan={userData.selectedPlan}
            />
          )}

          <Routes>
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  userData ? (
                    <JobAdForm personalData={userData} />
                  ) : (
                    <PersonalDataForm onSubmit={setUserData} />
                  )
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/login"
              element={
                !isAuthenticated ? (
                  <Login onLogin={handleLogin} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/register"
              element={
                !isAuthenticated ? (
                  <RegistrationForm onRegister={handleRegister} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route path="/success" element={<PaymentSuccess />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
        </main>
      </div>
    </Elements>
  );
}

export default App;
