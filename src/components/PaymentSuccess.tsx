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
  const RETRY_DELAY = 2000; // 2 seconds

  useEffect(() => {
    const verifyPaymentAndUpdate = async () => {
      try {
        // Get stored checkout information
        const pendingPlanStr = sessionStorage.getItem('pendingPlan');
        const sessionId = sessionStorage.getItem('checkoutSessionId');
        const pendingPlan = pendingPlanStr ? JSON.parse(pendingPlanStr) : null;
        
        // Get current user data
        const userData = await refreshUserData();
        
        if (!userData) {
          throw new Error('Failed to fetch user data');
        }

        // Always update the UI with latest user data
        if (onUpdateUser) {
          await onUpdateUser(userData);
        }

        // Check if the plan has been updated
        const planUpdated = pendingPlan && userData.selectedPlan !== 'Free Plan';

        // If plan is updated, clean up and redirect
        if (planUpdated) {
          // Clean up stored data
          sessionStorage.removeItem('pendingPlan');
          sessionStorage.removeItem('checkoutSessionId');

          // Navigate home
          navigate('/');
          return;
        }

        // If we've made all attempts and plan isn't updated, show a warning
        if (attempts >= MAX_ATTEMPTS - 1) {
          setError(`Your payment is being processed. If your plan is not updated within 24 hours, please contact support with reference: ${sessionId}`);
          
          // Clean up stored data
          sessionStorage.removeItem('pendingPlan');
          sessionStorage.removeItem('checkoutSessionId');
          
          // Navigate after delay
          setTimeout(() => navigate('/'), 5000);
          return;
        }

        // If plan is still not updated and we have more attempts, retry
        setAttempts(prev => prev + 1);
        
      } catch (error) {
        console.error('Error verifying payment:', error);
        setError('There was an issue verifying your payment. Your plan will be updated automatically when the payment is processed.');
        // Still navigate after a delay
        setTimeout(() => navigate('/'), 5000);
      }
    };

    // Start verification after initial delay
    const timer = setTimeout(verifyPaymentAndUpdate, RETRY_DELAY);
    return () => clearTimeout(timer);
  }, [navigate, onUpdateUser, attempts]);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 m-4 max-w-sm w-full">
        {error ? (
          <>
            <h2 className="text-2xl font-bold mb-4 text-center text-yellow-600">
              Payment Processing
            </h2>
            <p className="text-gray-600 text-center mb-4">
              {error}
            </p>
            <div className="mt-4 text-sm text-gray-500 text-center">
              Reference ID: {sessionStorage.getItem('checkoutSessionId') || 'Not available'}
            </div>
          </>
        ) : attempts < MAX_ATTEMPTS ? (
          <>
            <h2 className="text-2xl font-bold mb-4 text-center text-blue-600">
              Verifying Payment...
            </h2>
            <p className="text-gray-600 text-center">
              Please wait while we verify your payment...
            </p>
            <div className="mt-4 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4 text-center text-green-600">
              Payment Received
            </h2>
            <p className="text-gray-600 text-center">
              Your payment has been received. Your plan will be updated shortly.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
