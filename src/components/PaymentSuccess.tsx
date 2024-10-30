import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { refreshUserData } from '../utils/api';

const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      try {
        const userData = await refreshUserData();
        if (!userData) {
          throw new Error('Failed to update plan status');
        }
        // Navigate back to the main page after successful update
        navigate('/');
      } catch (error) {
        console.error('Error updating plan after payment:', error);
        setError('Failed to update your plan. Please contact support.');
        // Still navigate after a delay even if there's an error
        setTimeout(() => navigate('/'), 5000);
      }
    };

    handlePaymentSuccess();
  }, [navigate]);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 m-4 max-w-sm w-full">
        <h2 className="text-2xl font-bold mb-4 text-center text-green-600">
          Payment Successful!
        </h2>
        {error ? (
          <p className="text-red-600 text-center mb-4">
            {error}
          </p>
        ) : (
          <p className="text-gray-600 text-center">
            Your plan has been updated. You will be redirected shortly...
          </p>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
