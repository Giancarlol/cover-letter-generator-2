import React, { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQs: React.FC = () => {
  const faqs: FAQItem[] = [
    {
      question: "How does the AI cover letter generator work?",
      answer: "Our AI-powered system analyzes your job description and personal information to create a tailored, professional cover letter. It uses advanced language processing to highlight relevant skills and experiences that match the job requirements."
    },
    {
      question: "How long does it take to generate a cover letter?",
      answer: "The process typically takes just a few minutes. Once you input the job description and your personal details, our AI generates a customized cover letter almost instantly."
    },
    {
      question: "Can I edit the generated cover letter?",
      answer: "Yes! While our AI creates a strong initial draft, you can always review and modify the content to better match your voice and add specific details you'd like to emphasize."
    },
    {
      question: "Is my information secure?",
      answer: "Absolutely. We take data privacy seriously and use industry-standard encryption to protect your personal information. We never share your data with third parties."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards through our secure Stripe payment system. You can choose from different subscription plans based on your needs."
    }
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">Frequently Asked Questions</h2>
      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <div key={index} className="border rounded-lg overflow-hidden">
            <button
              className="w-full text-left px-6 py-4 bg-white hover:bg-gray-50 flex justify-between items-center"
              onClick={() => toggleFAQ(index)}
            >
              <span className="font-medium text-gray-800">{faq.question}</span>
              <span className="ml-6">
                {openIndex === index ? (
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </span>
            </button>
            {openIndex === index && (
              <div className="px-6 py-4 bg-gray-50">
                <p className="text-gray-700">{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FAQs;
