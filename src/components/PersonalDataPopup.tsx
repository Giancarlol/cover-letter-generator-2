import React, { useState } from 'react';
import { X } from 'lucide-react';

interface PersonalDataPopupProps {
  onClose: () => void;
  onSubmit: (data: { studies: string; experiences: string[] }) => void;
  initialData: { studies: string; experiences: string[] };
}

const PersonalDataPopup: React.FC<PersonalDataPopupProps> = ({ onClose, onSubmit, initialData }) => {
  const [studies, setStudies] = useState(initialData.studies);
  const [experiences, setExperiences] = useState(initialData.experiences.join('\n'));
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!studies.trim()) {
      newErrors.studies = 'Studies information is required';
    }

    if (!experiences.trim()) {
      newErrors.experiences = 'At least one experience is required';
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
        <h2 className="text-2xl font-bold mb-4">Personal Data</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="studies" className="block text-sm font-medium text-gray-700 mb-2">
              Studies
            </label>
            <textarea
              id="studies"
              value={studies}
              onChange={(e) => setStudies(e.target.value)}
              className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none focus:border-indigo-500"
              rows={3}
              placeholder="Enter your educational background"
            ></textarea>
            {errors.studies && <p className="mt-2 text-sm text-red-600">{errors.studies}</p>}
          </div>
          <div className="mb-4">
            <label htmlFor="experiences" className="block text-sm font-medium text-gray-700 mb-2">
              Experiences (one per line)
            </label>
            <textarea
              id="experiences"
              value={experiences}
              onChange={(e) => setExperiences(e.target.value)}
              className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none focus:border-indigo-500"
              rows={5}
              placeholder="Enter your work experiences, one per line"
            ></textarea>
            {errors.experiences && <p className="mt-2 text-sm text-red-600">{errors.experiences}</p>}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PersonalDataPopup;
