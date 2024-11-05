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
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 5;
  const RETRY_DELAY = 3000; // 3 seconds

  useEffect(() => {
    const verifyPaymentAndUpdate = async () => {
      try {
        console.log(`Attempt ${attempts + 1} of ${MAX_ATTEMPTS} to verify payment...`);
        
        // Get current user data
        const userData = await refreshUserData();
        console.log('Received user data:', userData);
        
        if (!userData) {
          throw new Error('Failed to fetch user data');
        }

        // If the user is still on Free Plan after payment, something went wrong
        if (userData.selectedPlan === 'Free Plan' && attempts < MAX_ATTEMPTS - 1) {
          console.log('Plan not yet updated, will retry...');
          setAttempts(prev => prev + 1);
          return; // Will trigger another attempt due to useEffect dependency
        }

        // If we got here and still on Free Plan, payment processing failed
        if (userData.selectedPlan === 'Free Plan') {
          throw new Error('Payment processing failed. Please contact support.');
        }
        
        // Payment processed successfully
        console.log('Payment verified successfully:', userData);
        if (onUpdateUser) {
          await onUpdateUser(userData);
        }
        
        navigate('/');
      } catch (error) {
        console.error('Error verifying payment:', error);
        setError(error instanceof Error ? error.message : 'Failed to verify payment status');
        // Still navigate after a delay if we hit an error
        setTimeout(() => navigate('/'), 5000);
      }
    };

    // Start verification after initial delay
    const timer = setTimeout(verifyPaymentAndUpdate, RETRY_DELAY);
    return () => clearTimeout(timer);
  }, [navigate, onUpdateUser, attempts]); // Include attempts in dependencies

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 m-4 max-w-sm w-full">
        {error ? (
          <>
            <h2 className="text-2xl font-bold mb-4 text-center text-red-600">
              Payment Error
            </h2>
            <p className="text-red-600 text-center mb-4">
              {error}
            </p>
          </>
        ) : attempts < MAX_ATTEMPTS ? (
          <>
            <h2 className="text-2xl font-bold mb-4 text-center text-blue-600">
              Verifying Payment...
            </h2>
            <p className="text-gray-600 text-center">
              Please wait while we verify your payment...
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4 text-center text-green-600">
              Payment Received!
            </h2>
            <p className="text-gray-600 text-center">
              Your plan has been updated. You will be redirected shortly...
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
