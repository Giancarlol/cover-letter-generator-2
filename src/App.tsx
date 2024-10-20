import React, { useState, useEffect } from 'react';
import { FileText, Send, UserPlus, CreditCard, LogOut } from 'lucide-react';
import JobAdForm from './components/JobAdForm';
import CoverLetter from './components/CoverLetter';
import RegistrationForm from './components/RegistrationForm';
import Login from './components/Login';
import PersonalDataPopup from './components/PersonalDataPopup';
import PaymentPlanSelection from './components/PaymentPlanSelection';
import { registerUser, updateUser, login, logout, checkAuth, generateCoverLetter, clearAuthToken, PersonalData, RegistrationData } from './utils/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [jobAd, setJobAd] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPersonalDataPopupOpen, setIsPersonalDataPopupOpen] = useState(false);
  const [isPaymentPlanPopupOpen, setIsPaymentPlanPopupOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const userData = await checkAuth();
      if (userData) {
        setIsAuthenticated(true);
        setPersonalData(userData);
      }
    } catch (error) {
      handleAuthError(error);
    }
  };

  const handleAuthError = (error: any) => {
    console.error('Authentication error:', error);
    setError(error.message);
    setIsAuthenticated(false);
    setPersonalData(null);
    setShowLogin(true);
    clearAuthToken();
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await login(email, password);
      setIsAuthenticated(true);
      setPersonalData(response.user);
      setShowLogin(false);
      setError(null);
    } catch (error) {
      console.error('Error logging in:', error);
      setError('Failed to login. Please check your credentials and try again.');
    }
  };

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
    setPersonalData(null);
    setShowLogin(true);
    setError(null);
  };

  const handleRegistration = async (userData: RegistrationData) => {
    try {
      await registerUser(userData);
      setShowLogin(true);
      setError('Registration successful. Please log in.');
    } catch (error) {
      console.error('Error registering user:', error);
      setError('Failed to register user. Please try again.');
    }
  };

  const handlePlanSelection = async (plan: string) => {
    if (!personalData) return;
    try {
      await updateUser(personalData.email, { selectedPlan: plan });
      setPersonalData({ ...personalData, selectedPlan: plan });
      setIsPaymentPlanPopupOpen(false);
    } catch (error) {
      handleAuthError(error);
    }
  };

  const handlePersonalDataSubmit = async (data: { studies: string; experiences: string[] }) => {
    if (!personalData) return;
    try {
      const updatedData = { ...personalData, ...data };
      await updateUser(personalData.email, updatedData);
      setPersonalData(updatedData);
      setIsPersonalDataPopupOpen(false);
    } catch (error) {
      handleAuthError(error);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!personalData || !jobAd) {
      setError('Please fill in both personal data and job ad details.');
      return;
    }

    if (personalData.selectedPlan === 'Free Plan' && personalData.letterCount >= 5) {
      setError('You have reached the limit of 5 letters per month on the Free Plan. Please upgrade to generate more letters.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const letter = await generateCoverLetter(personalData, jobAd);
      setCoverLetter(letter);
      const newLetterCount = personalData.letterCount + 1;
      const updatedPersonalData = { ...personalData, letterCount: newLetterCount };
      await updateUser(personalData.email, { letterCount: newLetterCount });
      setPersonalData(updatedPersonalData);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return showLogin ? (
      <Login onLogin={handleLogin} />
    ) : (
      <RegistrationForm onRegister={handleRegistration} />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12 relative">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      <div className="absolute top-4 right-4 flex space-x-2">
        <button
          onClick={() => setIsPaymentPlanPopupOpen(true)}
          className="flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <CreditCard className="mr-2 h-5 w-5" />
          {personalData?.selectedPlan ? 'Change Plan' : 'Select Plan'}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <LogOut className="mr-2 h-5 w-5" />
          Logout
        </button>
      </div>
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-light-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-3xl font-extrabold text-gray-900">AI Cover Letter Generator</h2>
                <button
                  onClick={() => setIsPersonalDataPopupOpen(true)}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <UserPlus className="mr-2 h-5 w-5" />
                  {personalData ? 'Edit Personal Data' : 'Add Personal Data'}
                </button>
                {personalData && (
                  <div className="mt-4">
                    <h3 className="text-lg font-medium text-gray-900">Personal Data</h3>
                    <p className="mt-1 text-sm text-gray-600">Your personal data has been saved.</p>
                  </div>
                )}
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900">Current Plan: {personalData?.selectedPlan}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Letters generated this month: {personalData?.letterCount} / {personalData?.selectedPlan === 'Free Plan' ? '5' : 'Unlimited'}
                  </p>
                </div>
                <JobAdForm jobAd={jobAd} setJobAd={setJobAd} />
                <button
                  onClick={handleGenerateCoverLetter}
                  disabled={isLoading || (personalData?.selectedPlan === 'Free Plan' && (personalData?.letterCount ?? 0) >= 5)}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    isLoading || (personalData?.selectedPlan === 'Free Plan' && (personalData?.letterCount ?? 0) >= 5) ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      Generate Cover Letter
                    </>
                  )}
                </button>
              </div>
              {coverLetter && <CoverLetter coverLetter={coverLetter} />}
            </div>
          </div>
        </div>
      </div>
      {isPersonalDataPopupOpen && personalData && (
        <PersonalDataPopup
          onClose={() => setIsPersonalDataPopupOpen(false)}
          onSubmit={handlePersonalDataSubmit}
          initialData={{
            studies: personalData.studies,
            experiences: personalData.experiences
          }}
        />
      )}
      {isPaymentPlanPopupOpen && (
        <PaymentPlanSelection
          onClose={() => setIsPaymentPlanPopupOpen(false)}
          onSelectPlan={handlePlanSelection}
          selectedPlan={personalData?.selectedPlan ?? ''}
        />
      )}
    </div>
  );
}

export default App;
