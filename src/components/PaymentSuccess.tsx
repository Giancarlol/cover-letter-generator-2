import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { refreshUserData } from '../utils/api';
import type { PersonalData } from '../utils/api';

interface PaymentSuccessProps {
  onUpdateUser?: (userData: PersonalData) => void;
}

const PaymentSuccess: React.FC<PaymentSuccessProps> = ({ onUpdateUser }) => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      try {
        // Add a delay to allow webhook processing to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('Refreshing user data after payment...');
        const userData = await refreshUserData();
        console.log('Refreshed user data:', userData);
        
        if (!userData) {
          throw new Error('Failed to update plan status');
        }
        
        // Update the parent component's state with the new user data
        if (onUpdateUser) {
          console.log('Calling onUpdateUser with:', userData);
          await onUpdateUser(userData);
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
  }, [navigate, onUpdateUser]);

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
