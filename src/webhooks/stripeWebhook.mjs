import Stripe from 'stripe';

// Initialize Stripe only if we have a secret key
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Function to get the customer's email from the payment intent or related objects
const getCustomerEmail = async (paymentIntent) => {
  let email = paymentIntent.receipt_email || paymentIntent.customer_details?.email || paymentIntent.metadata?.email;

  if (!email && paymentIntent.customer && stripe) {
    try {
      const customer = await stripe.customers.retrieve(paymentIntent.customer);
      email = customer.email;
    } catch (error) {
      console.error('Error fetching customer:', error);
    }
  }

  if (!email && paymentIntent.metadata?.checkout_session_id && stripe) {
    try {
      const session = await stripe.checkout.sessions.retrieve(paymentIntent.metadata.checkout_session_id);
      email = session.customer_email || session.customer_details?.email;
    } catch (error) {
      console.error('Error fetching checkout session:', error);
    }
  }

  if (!email) {
    throw new Error('No customer email found in payment intent or related objects');
  }

  return email;
};

// Main function to handle successful payments and update user plan in the database
const handlePaymentSuccess = async (db, paymentIntent, transporter) => {
  const users = db.collection('users');
  const amount = paymentIntent.amount;

  console.log('Payment intent details:', {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    status: paymentIntent.status,
    customer_details: paymentIntent.customer_details,
    receipt_email: paymentIntent.receipt_email,
    metadata: paymentIntent.metadata,
    customer: paymentIntent.customer,
    currency: paymentIntent.currency
  });

  const customerEmail = await getCustomerEmail(paymentIntent);
  console.log('Processing payment for customer:', customerEmail);

  let selectedPlan = 'Free Plan';
  let letterCount = 0;
  let planDuration = 0; // in days

  // Setting the plan details based on the payment amount in cents
  // Basic Plan: $3.99 = 399 cents
  // Premium Plan: $9.99 = 999 cents
  console.log('Determining plan based on amount:', amount);
  
  if (amount === 399) {
    selectedPlan = 'Basic Plan';
    letterCount = 20;
    planDuration = 7;
    console.log('Selected Basic Plan');
  } else if (amount === 999) {
    selectedPlan = 'Premium Plan';
    letterCount = 40;
    planDuration = 14;
    console.log('Selected Premium Plan');
  } else {
    console.log('Warning: Unrecognized payment amount:', amount);
    throw new Error(`Unrecognized payment amount: ${amount}`);
  }

  const subscriptionEndDate = new Date();
  subscriptionEndDate.setDate(subscriptionEndDate.getDate() + planDuration);

  console.log('Updating plan details:', { 
    selectedPlan, 
    letterCount, 
    email: customerEmail,
    subscriptionEndDate,
    amount,
    planDuration
  });

  // First, get the current user data
  const currentUser = await users.findOne({ email: customerEmail });
  console.log('Current user data:', currentUser);

  if (!currentUser) {
    throw new Error(`No user found with email: ${customerEmail}`);
  }

  // Use findOneAndUpdate to ensure atomic update
  const updateResult = await users.findOneAndUpdate(
    { 
      email: customerEmail,
      // Add version check to prevent concurrent updates
      _id: currentUser._id
    },
    {
      $set: {
        selectedPlan,
        letterCount,
        paymentStatus: 'completed',
        lastPaymentDate: new Date(),
        subscriptionEndDate,
        stripePaymentIntentId: paymentIntent.id
      }
    },
    {
      returnDocument: 'after' // Return the updated document
    }
  );

  console.log('Update result:', updateResult);

  if (!updateResult.value) {
    throw new Error(`Failed to update user plan for email: ${customerEmail}`);
  }

  const updatedUser = updateResult.value;
  console.log('Updated user data:', updatedUser);

  // Verify the update was successful
  if (updatedUser.selectedPlan !== selectedPlan || updatedUser.letterCount !== letterCount) {
    throw new Error('Plan update verification failed. Database values do not match expected values.');
  }

  // Send confirmation email
  if (transporter) {
    await sendConfirmationEmail(transporter, customerEmail, selectedPlan, letterCount, subscriptionEndDate);
  }

  return { customerEmail, selectedPlan, letterCount };
};

// Function to handle checkout session completion
const handleCheckoutSession = async (db, session, transporter) => {
  if (!stripe) {
    console.log('Stripe is not initialized - skipping checkout session processing');
    return null;
  }

  console.log('Processing checkout session:', {
    id: session.id,
    customer_email: session.customer_email,
    customer_details: session.customer_details,
    payment_intent: session.payment_intent,
    amount_total: session.amount_total,
    currency: session.currency,
    metadata: session.metadata
  });

  if (!session.payment_intent) {
    throw new Error('No payment intent found in checkout session');
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
  console.log('Retrieved payment intent:', {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    status: paymentIntent.status,
    metadata: paymentIntent.metadata
  });
  
  // Add checkout session ID to payment intent metadata for tracking
  await stripe.paymentIntents.update(paymentIntent.id, {
    metadata: {
      ...paymentIntent.metadata,
      checkout_session_id: session.id
    }
  });

  return handlePaymentSuccess(db, paymentIntent, transporter);
};

// Function to send a confirmation email after successful payment
const sendConfirmationEmail = async (transporter, customerEmail, selectedPlan, letterCount, subscriptionEndDate) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: customerEmail,
    subject: 'Payment Confirmation - Cover Letter Generator',
    html: `
      <h1>Thank you for your purchase!</h1>
      <p>Your payment has been successfully processed.</p>
      <p>Plan: ${selectedPlan}</p>
      <p>Available letter generations: ${letterCount}</p>
      <p>Subscription end date: ${subscriptionEndDate.toLocaleDateString()}</p>
      <p>If you have any questions, please don't hesitate to contact us.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Confirmation email sent to:', customerEmail);
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
  }
};

// Main webhook handler function
const handleWebhook = async (req, endpointSecret, db, transporter) => {
  // For local development without Stripe
  if (!stripe) {
    console.log('Stripe is not initialized - webhook handling skipped');
    return { success: true, result: null };
  }

  try {
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      throw new Error('No Stripe signature found');
    }

    if (!endpointSecret) {
      throw new Error('Webhook secret is not configured');
    }

    console.log('Constructing webhook event...');
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('Webhook verified successfully:', event.type);

    let result;

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Processing checkout.session.completed:', session.id);
        result = await handleCheckoutSession(db, session, transporter);
        console.log('Checkout session processed successfully:', result);
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Processing payment_intent.succeeded:', paymentIntent.id);
        result = await handlePaymentSuccess(db, paymentIntent, transporter);
        console.log('Payment processed successfully:', result);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    return { success: true, result };
  } catch (error) {
    console.error('Webhook error:', error);
    throw error;
  }
};

export { handleWebhook };
