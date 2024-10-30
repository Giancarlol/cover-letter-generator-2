import React, { useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface StripeCheckoutProps {
  planName: string;
  planPrice: number;
  onError: (error: string) => void;
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({ planName, planPrice, onError }) => {
  useEffect(() => {
    // Log for debugging (remove in production)
    console.log('Component mounted with:', {
      hasStripeKey: !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
      planName,
      planPrice
    });
  }, [planName, planPrice]);

  const handleCheckout = async () => {
    try {
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Failed to initialize Stripe');
      }

      // Get the auth token from localStorage
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('Authentication required');
      }

      console.log('Making request to create checkout session');
      console.log('Request payload:', { planName, planPrice });

      // Use the full URL instead of relative path
      const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
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

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('Error response:', text);
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || 'Failed to create checkout session');
        } catch (e) {
          throw new Error(`Server error: ${text}`);
        }
      }

      const data = await response.json();
      console.log('Session created:', data);

      if (!data.id) {
        throw new Error('Invalid session data received');
      }

      const result = await stripe.redirectToCheckout({
        sessionId: data.id,
      });

      if (result.error) {
        throw new Error(result.error.message || 'An error occurred during checkout');
      }
    } catch (error) {
      console.error('Stripe checkout error:', error);
      onError(error instanceof Error ? error.message : 'An error occurred during checkout');
    }
  };

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
