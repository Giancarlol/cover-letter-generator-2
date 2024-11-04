import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import Login from './components/Login';
import RegistrationForm from './components/RegistrationForm';
import JobAdForm from './components/JobAdForm';
import PersonalDataForm from './components/PersonalDataForm';
import PaymentPlanSelection from './components/PaymentPlanSelection';
import PaymentSuccess from './components/PaymentSuccess';
import ResetPassword from './components/ResetPassword';
import { checkAuth, clearAuthToken, registerUser, login } from './utils/api';
import type { PersonalData, RegistrationData } from './utils/api';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userData, setUserData] = useState<PersonalData | null>(null);
  const [showPaymentPlan, setShowPaymentPlan] = useState(false);

  const loadUserData = useCallback(async () => {
    try {
      const user = await checkAuth();
      if (user) {
        console.log('Loaded user data:', user);
        setIsAuthenticated(true);
        setUserData(user);
      } else {
        setIsAuthenticated(false);
        setUserData(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setIsAuthenticated(false);
      setUserData(null);
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleLogout = () => {
    clearAuthToken();
    setIsAuthenticated(false);
    setUserData(null);
  };

  const handleLogin = async (user: PersonalData) => {
    setIsAuthenticated(true);
    setUserData(user);
    await loadUserData();
  };

  const handleRegister = async (userData: RegistrationData) => {
    try {
      const response = await registerUser(userData);
      
      if (response.userId) {
        const loginResponse = await login(userData.email, userData.password);
        setIsAuthenticated(true);
        setUserData(loginResponse.user);
        await loadUserData();
      }
    } catch (error) {
      throw error;
    }
  };

  const handleSelectPlan = async (plan: string) => {
    if (userData) {
      setUserData({ ...userData, selectedPlan: plan });
      await loadUserData();
    }
    setShowPaymentPlan(false);
  };

  const handleUpdateUser = async (updatedUserData: PersonalData) => {
    console.log('Updating user data:', updatedUserData);
    setUserData(updatedUserData);
    await loadUserData();
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
                  <div className="mr-4 text-sm text-gray-600">
                    <div>Current Plan: {userData?.selectedPlan || 'Free Plan'}</div>
                    {userData?.subscriptionEndDate && (
                      <div className="text-xs text-gray-500">
                        Expires: {new Date(userData.subscriptionEndDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
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
              subscriptionEndDate={userData.subscriptionEndDate}
            />
          )}

          <Routes>
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  userData ? (
                    <JobAdForm 
                      key={userData.selectedPlan} // Force re-render when plan changes
                      personalData={userData}
                      onUpdate={handleUpdateUser}
                    />
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
            <Route 
              path="/success" 
              element={
                <PaymentSuccess 
                  onUpdateUser={handleUpdateUser} 
                />
              } 
            />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
        </main>
      </div>
    </Elements>
  );
}

export default App;
