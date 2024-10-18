import React, { useState, useEffect } from 'react';
import { X, BookOpen, Briefcase } from 'lucide-react';

interface PersonalDataPopupProps {
  onClose: () => void;
  onSubmit: (data: { studies: string; experiences: string[] }) => void;
  initialData?: { studies: string; experiences: string[] } | null;
}

const PersonalDataPopup: React.FC<PersonalDataPopupProps> = ({ onClose, onSubmit, initialData }) => {
  const [studies, setStudies] = useState(initialData?.studies || '');
  const [experiences, setExperiences] = useState(initialData?.experiences?.join(', ') || '');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      studies,
      experiences: experiences.split(',').map(exp => exp.trim()),
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl p-8 m-4 max-w-2xl w-full">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-6 w-6" />
        </button>
        <h3 className="text-xl font-semibold mb-4">Personal Data</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="studies" className="block text-sm font-medium text-gray-700">
              <BookOpen className="inline-block mr-2 h-5 w-5" />
              Studies
            </label>
            <textarea
              id="studies"
              value={studies}
              onChange={(e) => setStudies(e.target.value)}
              required
              rows={5}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="e.g., Bachelor's in Computer Science, University of Technology (2015-2019)&#10;Master's in Data Science, Tech Institute (2019-2021)"
            ></textarea>
            <p className="mt-1 text-sm text-gray-500">Include degrees, institutions, and years of study. List each degree on a new line.</p>
          </div>
          <div>
            <label htmlFor="experiences" className="block text-sm font-medium text-gray-700">
              <Briefcase className="inline-block mr-2 h-5 w-5" />
              Job Experiences
            </label>
            <textarea
              id="experiences"
              value={experiences}
              onChange={(e) => setExperiences(e.target.value)}
              required
              rows={5}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="e.g., Software Developer at Tech Co. (2019-2021)&#10;Project Manager at Innovate Inc. (2021-present)"
            ></textarea>
            <p className="mt-1 text-sm text-gray-500">List your job titles, companies, and years of employment. Add each experience on a new line.</p>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Save Personal Data
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PersonalDataPopup;