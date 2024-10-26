import React, { useState } from 'react';
import { PersonalData, updateUser } from '../utils/api';
import PersonalDataPopup from './PersonalDataPopup';

export interface JobAdFormProps {
  personalData: PersonalData;
}

const JobAdForm: React.FC<JobAdFormProps> = ({ personalData }) => {
  const [jobAd, setJobAd] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [currentPersonalData, setCurrentPersonalData] = useState(personalData);

  const getMaxLetters = (plan: string) => {
    switch (plan) {
      case 'Free Plan':
        return 20;
      case 'Basic Plan':
        return 50;
      case 'Premium Plan':
        return 100;
      default:
        return 20;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle job ad submission
  };

  const handlePopupSubmit = async (data: { studies: string; experiences: string[] }) => {
    try {
      // Update the backend
      await updateUser(currentPersonalData.email, {
        studies: data.studies,
        experiences: data.experiences
      });

      // Update local state
      setCurrentPersonalData(prev => ({
        ...prev,
        studies: data.studies,
        experiences: data.experiences
      }));
      setShowPopup(false);
    } catch (error) {
      console.error('Error updating user data:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const maxLetters = getMaxLetters(currentPersonalData?.selectedPlan || 'Free Plan');
  const lettersLeft = maxLetters - (currentPersonalData?.letterCount || 0);

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-lg">
      <h1 className="text-4xl font-bold text-center mb-4">AI Cover Letter Generator</h1>
      
      <div className="mb-8 text-center">
        <div className="text-gray-600 mb-2">
          Current Plan: <span className="font-semibold">{currentPersonalData?.selectedPlan || 'Free Plan'}</span>
        </div>
        <div className="text-gray-600">
          Letters Generated: <span className="font-semibold">{currentPersonalData?.letterCount || 0}/{maxLetters}</span>
          {lettersLeft > 0 && (
            <span className="ml-2 text-sm">
              ({lettersLeft} letter{lettersLeft !== 1 ? 's' : ''} remaining)
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
            value={currentPersonalData?.name || ''}
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
            value={currentPersonalData?.studies || ''}
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
            value={currentPersonalData?.experiences && currentPersonalData.experiences.length > 0 ? currentPersonalData.experiences[0] : ''}
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
          className="w-full bg-[#818cf8] hover:bg-[#6366f1] text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
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
            studies: currentPersonalData?.studies || '',
            experiences: currentPersonalData?.experiences || []
          }}
        />
      )}
    </div>
  );
};

export default JobAdForm;
