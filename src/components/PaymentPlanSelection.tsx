import React from 'react';
import { Check, X } from 'lucide-react';
import StripeCheckout from './StripeCheckout';

interface PaymentPlanProps {
  onSelectPlan: (plan: string) => void;
  onClose: () => void;
  selectedPlan: string | null;
}

const PaymentPlanSelection: React.FC<PaymentPlanProps> = ({ onSelectPlan, onClose, selectedPlan }) => {
  const plans = [
    { name: 'Free Plan', price: 0, letters: 5, features: ['5 letters per month', 'Basic templates'] },
    { name: 'Basic Plan', price: 499, letters: 20, features: ['20 letters per month', 'More templates', 'Priority support'] },
    { name: 'Premium Plan', price: 899, letters: 40, features: ['40 letters per month', 'All templates', '24/7 support', 'Advanced customization'] },
  ];

  const handleError = (error: string) => {
    console.error('Stripe error:', error);
    // You might want to show this error to the user
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
      <div className="relative bg-white rounded-lg shadow-xl p-8 m-4 max-w-4xl w-full">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">
          Choose Your Plan
        </h2>
        <p className="text-center text-gray-600 mb-8">
          Select the plan that best fits your needs
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.name} className="border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200">
              <div className="p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">{plan.name}</h3>
                <p className="mt-4 text-sm text-gray-500">{plan.letters} letters per month</p>
                <p className="mt-8">
                  <span className="text-4xl font-extrabold text-gray-900">${(plan.price / 100).toFixed(2)}</span>
                  {plan.price !== 0 && <span className="text-base font-medium text-gray-500">/mo</span>}
                </p>
                {plan.price === 0 ? (
                  <button
                    onClick={() => onSelectPlan(plan.name)}
                    className={`mt-8 block w-full border border-transparent rounded-md py-2 text-sm font-semibold text-white text-center ${
                      selectedPlan === plan.name
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {selectedPlan === plan.name ? 'Current Plan' : `Select ${plan.name}`}
                  </button>
                ) : (
                  <StripeCheckout
                    planName={plan.name}
                    planPrice={plan.price}
                    onError={handleError}
                  />
                )}
              </div>
              <div className="pt-6 pb-8 px-6">
                <h4 className="text-sm leading-5 font-medium text-gray-900 tracking-wide uppercase">
                  What's included
                </h4>
                <ul className="mt-4 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <div className="flex-shrink-0">
                        <Check className="h-6 w-6 text-green-500" aria-hidden="true" />
                      </div>
                      <p className="ml-3 text-sm text-gray-700">{feature}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PaymentPlanSelection;
