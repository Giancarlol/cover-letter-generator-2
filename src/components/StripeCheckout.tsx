import React, { useEffect, useState } from 'react';
import { useStripe } from '@stripe/react-stripe-js';

declare global {
  interface Window {
    env: {
      VITE_STRIPE_PUBLISHABLE_KEY: string;
      VITE_API_BASE_URL: string;
    };
  }
}

interface StripeCheckoutProps {
  planName: string;
  planPrice: number;
  onError: (error: string) => void;
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({ planName, planPrice, onError }) => {
  const stripe = useStripe();
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  useEffect(() => {
    // Wait for config to be loaded
    const checkConfig = () => {
      if (window.env) {
        setIsConfigLoaded(true);
      } else {
        setTimeout(checkConfig, 100);
      }
    };
    checkConfig();
  }, []);

  useEffect(() => {
    if (isConfigLoaded) {
      // Store plan details in sessionStorage for verification
      sessionStorage.setItem('pendingPlan', JSON.stringify({
        name: planName,
        price: planPrice,
        timestamp: new Date().toISOString()
      }));
    }
  }, [planName, planPrice, isConfigLoaded]);

  const handleCheckout = async () => {
    try {
      if (!stripe) {
        throw new Error('Failed to initialize Stripe');
      }

      if (!isConfigLoaded) {
        throw new Error('Configuration not yet loaded');
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
      sessionStorage.removeItem('pendingPlan');
      sessionStorage.removeItem('checkoutSessionId');
      onError(error instanceof Error ? error.message : 'An error occurred during checkout');
    }
  };

  if (!isConfigLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <button
      onClick={handleCheckout}
      className="mt-8 block w-full border border-transparent rounded-md py-2 text-sm font-semibold text-white text-center bg-indigo-600 hover:bg-indigo-700"
    >
      Subscribe to {planName}
    </button>
  );
};

export default StripeCheckout;
