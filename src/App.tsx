import React, { useState, useEffect } from 'react';
import { FileText, Send, UserPlus, CreditCard } from 'lucide-react';
import JobAdForm from './components/JobAdForm';
import CoverLetter from './components/CoverLetter';
import RegistrationForm from './components/RegistrationForm';
import PersonalDataPopup from './components/PersonalDataPopup';
import PaymentPlanSelection from './components/PaymentPlanSelection';
import { generateCoverLetter } from './utils/coverLetterGenerator';
import mockMongoDB from './utils/mongodb';

function App() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('Free Plan');
  const [personalData, setPersonalData] = useState(null);
  const [jobAd, setJobAd] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPersonalDataPopupOpen, setIsPersonalDataPopupOpen] = useState(false);
  const [isPaymentPlanPopupOpen, setIsPaymentPlanPopupOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [letterCount, setLetterCount] = useState(0);

  useEffect(() => {
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      setError("OpenAI API key is not set. Please set the VITE_OPENAI_API_KEY environment variable.");
    }
  }, []);

  const handleRegistration = async (userData) => {
    try {
      const result = await mockMongoDB.insertUser({
        ...userData,
        selectedPlan: 'Free Plan',
        letterCount: 0
      });
      console.log('User registered:', result.insertedId);
      setIsRegistered(true);
      setPersonalData(userData);
      setSelectedPlan('Free Plan');
      setLetterCount(0);
    } catch (error) {
      console.error('Error registering user:', error);
      setError('Failed to register user. Please try again.');
    }
  };

  const handlePlanSelection = async (plan: string) => {
    try {
      await mockMongoDB.updateUser(personalData.email, { selectedPlan: plan });
      console.log('Selected plan:', plan);
      setSelectedPlan(plan);
      setIsPaymentPlanPopupOpen(false);
    } catch (error) {
      console.error('Error updating plan:', error);
      setError('Failed to update plan. Please try again.');
    }
  };

  const handlePersonalDataSubmit = async (data) => {
    try {
      await mockMongoDB.updateUser(data.email, { personalData: data });
      setPersonalData(data);
      setIsPersonalDataPopupOpen(false);
    } catch (error) {
      console.error('Error updating personal data:', error);
      setError('Failed to update personal data. Please try again.');
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!personalData || !jobAd) {
      setError('Please fill in both personal data and job ad details.');
      return;
    }

    if (selectedPlan === 'Free Plan' && letterCount >= 5) {
      setError('You have reached the limit of 5 letters per month on the Free Plan. Please upgrade to generate more letters.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const letter = await generateCoverLetter(personalData, jobAd);
      if (letter.startsWith('Error:')) {
        setError(letter);
      } else {
        setCoverLetter(letter);
        const newLetterCount = letterCount + 1;
        setLetterCount(newLetterCount);
        await mockMongoDB.insertCoverLetter({
          userId: personalData.email,
          jobAd,
          coverLetter: letter,
          createdAt: new Date()
        });
        await mockMongoDB.updateUser(personalData.email, { letterCount: newLetterCount });
      }
    } catch (error) {
      console.error('Error generating cover letter:', error);
      setError(`An unexpected error occurred. Please try again. Error details: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRegistered) {
    return <RegistrationForm onRegister={handleRegistration} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12 relative">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      <button
        onClick={() => setIsPaymentPlanPopupOpen(true)}
        className="absolute top-4 right-4 flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        <CreditCard className="mr-2 h-5 w-5" />
        {selectedPlan ? 'Change Plan' : 'Select Plan'}
      </button>
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
                  <h3 className="text-lg font-medium text-gray-900">Current Plan: {selectedPlan}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Letters generated this month: {letterCount} / {selectedPlan === 'Free Plan' ? '5' : 'Unlimited'}
                  </p>
                </div>
                <JobAdForm jobAd={jobAd} setJobAd={setJobAd} />
                <button
                  onClick={handleGenerateCoverLetter}
                  disabled={isLoading || (selectedPlan === 'Free Plan' && letterCount >= 5)}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    isLoading || (selectedPlan === 'Free Plan' && letterCount >= 5) ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
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
      {isPersonalDataPopupOpen && (
        <PersonalDataPopup
          onClose={() => setIsPersonalDataPopupOpen(false)}
          onSubmit={handlePersonalDataSubmit}
          initialData={personalData}
        />
      )}
      {isPaymentPlanPopupOpen && (
        <PaymentPlanSelection
          onClose={() => setIsPaymentPlanPopupOpen(false)}
          onSelectPlan={handlePlanSelection}
          selectedPlan={selectedPlan}
        />
      )}
    </div>
  );
}

export default App;