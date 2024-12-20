import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useTranslation } from 'react-i18next';
import './i18n/config';
import Login from './components/Login';
import RegistrationForm from './components/RegistrationForm';
import JobAdForm from './components/JobAdForm';
import PersonalDataForm from './components/PersonalDataForm';
import PaymentPlanSelection from './components/PaymentPlanSelection';
import PaymentSuccess from './components/PaymentSuccess';
import ResetPassword from './components/ResetPassword';
import FAQs from './components/FAQs';
import ContactForm from './components/ContactForm';
import { checkAuth, clearAuthToken, registerUser, login } from './utils/api';
import type { PersonalData, RegistrationData } from './utils/api';

declare global {
  interface Window {
    env: {
      VITE_STRIPE_PUBLISHABLE_KEY: string;
      VITE_API_BASE_URL: string;
    };
  }
}

function App() {
  const { t, i18n } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userData, setUserData] = useState<PersonalData | null>(null);
  const [showPaymentPlan, setShowPaymentPlan] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);

  // Fetch Stripe publishable key from API
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        
        if (data.VITE_STRIPE_PUBLISHABLE_KEY) {
          setStripePromise(loadStripe(data.VITE_STRIPE_PUBLISHABLE_KEY));
        } else {
          console.error('Stripe publishable key not found in API response');
        }
      } catch (error) {
        console.error('Error fetching config:', error);
      }
    };
    
    fetchConfig();
  }, []);

  const loadUserData = useCallback(async () => {
    try {
      const user = await checkAuth();
      if (user) {
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
    setUserData(updatedUserData);
    await loadUserData();
  };

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
  };

  if (!stripePromise) {
    return <div>Loading Stripe...</div>;
  }

  return (
    <Elements stripe={stripePromise}>
      <div className="min-h-screen bg-gray-100">
        <header role="banner">
          <nav className="bg-white shadow-sm" role="navigation" aria-label="Main navigation">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <div className="flex-shrink-0 flex items-center">
                    <Link to="/" className="text-xl font-bold text-gray-900" aria-label="Home">
                      <h1 className="text-xl font-bold">{t('navigation.coverLetterGenerator')}</h1>
                    </Link>
                  </div>
                </div>
                <div className="flex items-center">
                  {/* Language Selector */}
                  <select
                    onChange={(e) => changeLanguage(e.target.value)}
                    value={i18n.language}
                    className="mr-4 px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Select language"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="sv">Svenska</option>
                  </select>

                  <Link
                    to="/contact"
                    className="mr-4 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                    aria-label="Contact us"
                  >
                    {t('navigation.contact')}
                  </Link>

                  <Link
                    to="/faqs"
                    className="mr-4 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                    aria-label="Frequently asked questions"
                  >
                    {t('navigation.faqs')}
                  </Link>
                  {isAuthenticated && (
                    <>
                      <div className="mr-4 text-sm text-gray-600" role="status">
                        <div>{t('navigation.currentPlan')}: {userData?.selectedPlan || t('plans.freePlan')}</div>
                        {userData?.subscriptionEndDate && (
                          <div className="text-xs text-gray-500">
                            {t('navigation.expires')}: {new Date(userData.subscriptionEndDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setShowPaymentPlan(true)}
                        className="mr-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        aria-label="View payment plans"
                      >
                        {t('navigation.plans')}
                      </button>
                      <button
                        onClick={handleLogout}
                        className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                        aria-label="Log out"
                      >
                        {t('navigation.logout')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </nav>
        </header>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8" role="main">
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
                      key={userData.selectedPlan}
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
            <Route path="/faqs" element={<FAQs />} />
            <Route path="/contact" element={<ContactForm />} />
          </Routes>
        </main>

        <footer className="bg-white shadow-sm mt-8" role="contentinfo">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <nav aria-label="Footer navigation">
              <ul className="flex justify-center space-x-6">
                <li>
                  <Link to="/contact" className="text-sm text-gray-500 hover:text-gray-900">
                    {t('navigation.contact')}
                  </Link>
                </li>
                <li>
                  <Link to="/faqs" className="text-sm text-gray-500 hover:text-gray-900">
                    {t('navigation.faqs')}
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </footer>
      </div>
    </Elements>
  );
}

export default App;
