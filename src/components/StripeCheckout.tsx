import React from 'react';
import { loadStripe } from '@stripe/stripe-js';

// Replace with your actual Stripe publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface StripeCheckoutProps {
  planName: string;
  planPrice: number;
  onSuccess: (planName: string) => void;
  onError: (error: string) => void;
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({ planName, planPrice, onSuccess, onError }) => {
  const handleCheckout = async () => {
    const stripe = await stripePromise;
    if (!stripe) {
      onError('Failed to load Stripe');
      return;
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planName,
          planPrice,
        }),
      });

      const session = await response.json();

      const result = await stripe.redirectToCheckout({
        sessionId: session.id,
      });

      if (result.error) {
        onError(result.error.message);
      }
    } catch (error) {
      onError('An error occurred during checkout');
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