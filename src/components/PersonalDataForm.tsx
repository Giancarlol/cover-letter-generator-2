import React, { useState } from 'react';
import { User, BookOpen, Briefcase } from 'lucide-react';

interface PersonalDataFormProps {
  setPersonalData: (data: any) => void;
}

const PersonalDataForm: React.FC<PersonalDataFormProps> = ({ setPersonalData }) => {
  const [name, setName] = useState('');
  const [studies, setStudies] = useState('');
  const [experiences, setExperiences] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalData({
      name,
      studies,
      experiences: experiences.split(',').map(exp => exp.trim()),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          <User className="inline-block mr-2 h-5 w-5" />
          Full Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="studies" className="block text-sm font-medium text-gray-700">
          <BookOpen className="inline-block mr-2 h-5 w-5" />
          Studies
        </label>
        <input
          type="text"
          id="studies"
          value={studies}
          onChange={(e) => setStudies(e.target.value)}
          required
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="experiences" className="block text-sm font-medium text-gray-700">
          <Briefcase className="inline-block mr-2 h-5 w-5" />
          Job Experiences (comma-separated)
        </label>
        <input
          type="text"
          id="experiences"
          value={experiences}
          onChange={(e) => setExperiences(e.target.value)}
          required
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <button
        type="submit"
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Save Personal Data
      </button>
    </form>
  );
};

export default PersonalDataForm;