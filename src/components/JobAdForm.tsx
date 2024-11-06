import React, { useState, useEffect } from 'react';
import { PersonalData, updateUser } from '../utils/api';
import PersonalDataPopup from './PersonalDataPopup';

export interface JobAdFormProps {
  personalData: PersonalData;
  onUpdate?: (userData: PersonalData) => void;
}

const JobAdForm: React.FC<JobAdFormProps> = ({ personalData, onUpdate }) => {
  const [jobAd, setJobAd] = useState('');
  const [showPopup, setShowPopup] = useState(false);

  // Update component when personalData changes
  useEffect(() => {
    console.log('JobAdForm received updated personalData:', personalData);
  }, [personalData]);

  const getMaxLetters = (plan: string) => {
    switch (plan) {
      case 'Free Plan':
        return 5;  // Updated to match PaymentPlanSelection
      case 'Basic Plan':
        return 20; // Updated to match PaymentPlanSelection
      case 'Premium Plan':
        return 40; // Updated to match PaymentPlanSelection
      default:
        return 5;  // Default to Free Plan limit
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle job ad submission
  };

  const handlePopupSubmit = async (data: { studies: string; experiences: string[] }) => {
    try {
      // Update the backend
      await updateUser(personalData.email, {
        studies: data.studies,
        experiences: data.experiences
      });

      // If onUpdate is provided, call it with the updated data
      if (onUpdate) {
        onUpdate({
          ...personalData,
          studies: data.studies,
          experiences: data.experiences
        });
      }

      setShowPopup(false);
    } catch (error) {
      console.error('Error updating user data:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const maxLetters = getMaxLetters(personalData?.selectedPlan || 'Free Plan');
  // letterCount now directly represents remaining letters, no need for subtraction
  const lettersLeft = personalData?.letterCount || 0;

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-lg">
      <h1 className="text-4xl font-bold text-center mb-4">AI Cover Letter Generator</h1>
      
      <div className="mb-8 text-center">
        <div className="text-gray-600 mb-2">
          Current Plan: <span className="font-semibold">{personalData?.selectedPlan || 'Free Plan'}</span>
        </div>
        <div className="text-gray-600">
          Letters Remaining: <span className="font-semibold">{lettersLeft}/{maxLetters}</span>
          {lettersLeft > 0 ? (
            <span className="ml-2 text-sm">
              ({lettersLeft} letter{lettersLeft !== 1 ? 's' : ''} remaining)
            </span>
          ) : (
            <span className="ml-2 text-sm text-red-600">
              (No letters remaining - Please upgrade your plan)
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={personalData?.name || ''}
            disabled
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            Your Studies
          </label>
          <input
            type="text"
            value={personalData?.studies || ''}
            disabled
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            Your Experience
          </label>
          <input
            type="text"
            value={personalData?.experiences && personalData.experiences.length > 0 ? personalData.experiences[0] : ''}
            disabled
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowPopup(true)}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Edit Studies & Experience
        </button>

        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Job Advertisement
          </label>
          <textarea
            value={jobAd}
            onChange={(e) => setJobAd(e.target.value)}
            placeholder="Paste the job advertisement here..."
            rows={6}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <button
          type="submit"
          disabled={lettersLeft <= 0}
          className={`w-full font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 ${
            lettersLeft <= 0 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-[#818cf8] hover:bg-[#6366f1] text-white'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Generate Cover Letter
        </button>
      </form>

      {showPopup && (
        <PersonalDataPopup
          onClose={() => setShowPopup(false)}
          onSubmit={handlePopupSubmit}
          initialData={{
            studies: personalData?.studies || '',
            experiences: personalData?.experiences || []
          }}
        />
      )}
    </div>
  );
};

export default JobAdForm;
