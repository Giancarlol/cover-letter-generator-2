import React from 'react';
import { FileText } from 'lucide-react';

interface JobAdFormProps {
  jobAd: string;
  setJobAd: (jobAd: string) => void;
}

const JobAdForm: React.FC<JobAdFormProps> = ({ jobAd, setJobAd }) => {
  return (
    <div>
      <label htmlFor="jobAd" className="block text-sm font-medium text-gray-700">
        <FileText className="inline-block mr-2 h-5 w-5" />
        Job Advertisement
      </label>
      <textarea
        id="jobAd"
        rows={4}
        value={jobAd}
        onChange={(e) => setJobAd(e.target.value)}
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        placeholder="Paste the job advertisement here..."
      ></textarea>
    </div>
  );
};

export default JobAdForm;