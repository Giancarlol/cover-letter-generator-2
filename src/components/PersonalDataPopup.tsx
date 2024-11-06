import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PersonalDataPopupProps {
  onClose: () => void;
  onSubmit: (data: { studies: string; experiences: string[] }) => void;
  initialData: { studies: string; experiences: string[] };
}

const PersonalDataPopup: React.FC<PersonalDataPopupProps> = ({ onClose, onSubmit, initialData }) => {
  const { t } = useTranslation();
  const [studies, setStudies] = useState(initialData.studies || '');
  const [experiences, setExperiences] = useState(
    Array.isArray(initialData.experiences) ? initialData.experiences.join('\n') : ''
  );
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!studies.trim()) {
      newErrors.studies = t('personalDataPopup.errors.studiesRequired');
    }

    if (!experiences.trim()) {
      newErrors.experiences = t('personalDataPopup.errors.experiencesRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        studies,
        experiences: experiences.split('\n').filter(exp => exp.trim() !== '')
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl p-8 m-4 max-w-xl w-full">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>
        <h2 className="text-2xl font-bold mb-4">{t('personalDataPopup.title')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="studies" className="block text-sm font-medium text-gray-700 mb-2">
              {t('personalDataPopup.studies')}
            </label>
            <textarea
              id="studies"
              value={studies}
              onChange={(e) => setStudies(e.target.value)}
              className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none focus:border-indigo-500"
              rows={3}
              placeholder={t('personalDataPopup.studiesPlaceholder')}
            ></textarea>
            {errors.studies && <p className="mt-2 text-sm text-red-600">{errors.studies}</p>}
          </div>
          <div className="mb-4">
            <label htmlFor="experiences" className="block text-sm font-medium text-gray-700 mb-2">
              {t('personalDataPopup.experiences')}
            </label>
            <textarea
              id="experiences"
              value={experiences}
              onChange={(e) => setExperiences(e.target.value)}
              className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none focus:border-indigo-500"
              rows={5}
              placeholder={t('personalDataPopup.experiencesPlaceholder')}
            ></textarea>
            {errors.experiences && <p className="mt-2 text-sm text-red-600">{errors.experiences}</p>}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {t('personalDataPopup.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PersonalDataPopup;
