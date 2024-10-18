import React from 'react';

interface CoverLetterProps {
  coverLetter: string;
}

const CoverLetter: React.FC<CoverLetterProps> = ({ coverLetter }) => {
  return (
    <div className="mt-8">
      <h3 className="text-lg font-medium text-gray-900">Generated Cover Letter</h3>
      <div className="mt-2 p-4 bg-gray-50 rounded-md">
        <pre className="text-sm text-gray-700 whitespace-pre-wrap">{coverLetter}</pre>
      </div>
    </div>
  );
};

export default CoverLetter;