import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PersonalData, updateUser, generateCoverLetter } from '../utils/api';
import PersonalDataPopup from './PersonalDataPopup';

export interface JobAdFormProps {
  personalData: PersonalData;
  onUpdate?: (userData: PersonalData) => void;
}

const JobAdForm: React.FC<JobAdFormProps> = ({ personalData, onUpdate }) => {
  const { t } = useTranslation();
  const [jobAd, setJobAd] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMaxLetters = (plan: string) => {
    switch (plan) {
      case t('plans.freePlan'):
        return 5;
      case t('plans.basicPlan'):
        return 20;
      case t('plans.premiumPlan'):
        return 40;
      default:
        return 5;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobAd.trim()) {
      setError(t('errors.jobAdRequired'));
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedLetter(null);

    try {
      const letter = await generateCoverLetter(personalData, jobAd);
      setGeneratedLetter(letter);
      
      // Update the user data to reflect the new letter count
      if (onUpdate) {
        const updatedPersonalData = {
          ...personalData,
          letterCount: personalData.letterCount - 1
        };
        onUpdate(updatedPersonalData);
      }
    } catch (error) {
      console.error('Error generating cover letter:', error);
      setError(error instanceof Error ? error.message : t('errors.generateFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePopupSubmit = async (data: { studies: string; experiences: string[] }) => {
    try {
      await updateUser(personalData.email, {
        studies: data.studies,
        experiences: data.experiences
      });

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

  const maxLetters = getMaxLetters(personalData?.selectedPlan || t('plans.freePlan'));
  const lettersLeft = personalData?.letterCount || 0;

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-lg">
      <h1 className="text-4xl font-bold text-center mb-4">{t('navigation.coverLetterGenerator')}</h1>
      
      <div className="mb-8 text-center">
        <div className="text-gray-600 mb-2">
          {t('forms.currentPlanLabel')}: <span className="font-semibold">{personalData?.selectedPlan || t('plans.freePlan')}</span>
        </div>
        <div className="text-gray-600">
          {t('forms.lettersRemainingLabel')}: <span className="font-semibold">{lettersLeft}/{maxLetters}</span>
          {lettersLeft > 0 ? (
            <span className="ml-2 text-sm">
              ({t('forms.lettersRemaining', { count: lettersLeft })})
            </span>
          ) : (
            <span className="ml-2 text-sm text-red-600">
              ({t('forms.noLettersRemaining')})
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('forms.yourName')}
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
            {t('forms.yourStudies')}
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
            {t('forms.yourExperience')}
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
          {t('forms.editStudiesExperience')}
        </button>

        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t('forms.jobAd')}
          </label>
          <textarea
            value={jobAd}
            onChange={(e) => setJobAd(e.target.value)}
            placeholder={t('forms.jobAdPlaceholder')}
            rows={6}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={lettersLeft <= 0 || isGenerating}
          className={`w-full font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 ${
            lettersLeft <= 0 || isGenerating
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-[#818cf8] hover:bg-[#6366f1] text-white'
          }`}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('forms.generating')}
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {t('forms.generateCoverLetter')}
            </>
          )}
        </button>
      </form>

      {generatedLetter && (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">{t('forms.generatedLetter')}</h2>
          <div className="whitespace-pre-wrap">{generatedLetter}</div>
        </div>
      )}

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
