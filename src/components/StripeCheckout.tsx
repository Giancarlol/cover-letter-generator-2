import React, { useEffect, useState } from 'react';
import { useStripe } from '@stripe/react-stripe-js';

interface StripeCheckoutProps {
  planName: string;
  planPrice: number;
  onError: (error: string) => void;
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({ planName, planPrice, onError }) => {
  const stripe = useStripe();
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    try {
      setIsLoading(true);

      if (!stripe) {
        throw new Error('Failed to initialize Stripe');
      }

      // Get the auth token from localStorage
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('Authentication required');
      }

      console.log('Initiating checkout for:', {
        planName,
        planPrice,
        timestamp: new Date().toISOString()
      });

      // Store the pending plan information
      sessionStorage.setItem('pendingPlan', JSON.stringify({
        name: planName,
        price: planPrice,
        timestamp: new Date().toISOString()
      }));

      // Use the API endpoint directly since proxy is configured
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          planName,
          planPrice,
        }),
      });

      console.log('Checkout session response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error('Checkout session error:', text);
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || 'Failed to create checkout session');
        } catch (e) {
          throw new Error(`Server error: ${text}`);
        }
      }

      const data = await response.json();
      console.log('Checkout session created:', {
        sessionId: data.id,
        timestamp: new Date().toISOString()
      });

      if (!data.id) {
        throw new Error('Invalid session data received');
      }

      // Store the session ID for verification
      sessionStorage.setItem('checkoutSessionId', data.id);

      const result = await stripe.redirectToCheckout({
        sessionId: data.id,
      });

      if (result.error) {
        console.error('Stripe redirect error:', result.error);
        throw new Error(result.error.message || 'An error occurred during checkout');
      }
    } catch (error) {
      console.error('Stripe checkout error:', error);
      // Clear stored data on error
      sessionStorage.removeItem('checkoutSessionId');
      sessionStorage.removeItem('pendingPlan');
      onError(error instanceof Error ? error.message : 'An error occurred during checkout');
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Only clean up if there was an error (no successful redirect)
      if (document.location.pathname !== '/success') {
        sessionStorage.removeItem('checkoutSessionId');
        sessionStorage.removeItem('pendingPlan');
      }
    };
  }, []);

  if (!stripe) {
    return <div className="text-center p-4">Loading payment system...</div>;
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={isLoading}
      className={`mt-8 block w-full border border-transparent rounded-md py-2 text-sm font-semibold text-white text-center ${
        isLoading 
          ? 'bg-indigo-400 cursor-not-allowed' 
          : 'bg-indigo-600 hover:bg-indigo-700'
      }`}
    >
      {isLoading ? 'Processing...' : `Subscribe to ${planName}`}
    </button>
  );
};

export default StripeCheckout;
