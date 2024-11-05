const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const getCustomerEmail = async (paymentIntent) => {
  // First try to get email from payment intent
  let email = 
    paymentIntent.receipt_email || 
    paymentIntent.customer_details?.email ||
    paymentIntent.metadata?.email;

  // If no email found and we have a customer ID, fetch customer details
  if (!email && paymentIntent.customer) {
    try {
      const customer = await stripe.customers.retrieve(paymentIntent.customer);
      email = customer.email;
    } catch (error) {
      console.error('Error fetching customer:', error);
    }
  }

  // If still no email, try to get from the associated checkout session
  if (!email && paymentIntent.metadata?.checkout_session_id) {
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
    customer: paymentIntent.customer
  });

  const customerEmail = await getCustomerEmail(paymentIntent);
  console.log('Processing payment for customer:', customerEmail);

  let selectedPlan = 'Free Plan';
  let additionalLetters = 0;

  if (amount === 399) {
    selectedPlan = 'Basic Plan';
    additionalLetters = 20;  // Updated to match PaymentPlanSelection.tsx
  } else if (amount === 999) {
    selectedPlan = 'Premium Plan';
    additionalLetters = 40;  // Updated to match PaymentPlanSelection.tsx
  }

  console.log('Updating plan details:', { selectedPlan, additionalLetters, email: customerEmail });

  const updateResult = await users.updateOne(
    { email: customerEmail },
    {
      $set: {
        selectedPlan,
        paymentStatus: 'completed',
        lastPaymentDate: new Date(),
        stripePaymentIntentId: paymentIntent.id
      },
      $inc: { letterCount: additionalLetters }
    }
  );

  console.log('Update result:', updateResult);

  if (updateResult.matchedCount === 0) {
    throw new Error(`No user found with email: ${customerEmail}`);
  }

  if (updateResult.modifiedCount === 0) {
    throw new Error('Failed to update user plan');
  }

  // Get updated user data for email
  const updatedUser = await users.findOne({ email: customerEmail });
  const currentLetterCount = updatedUser.letterCount || additionalLetters;

  await sendConfirmationEmail(transporter, customerEmail, selectedPlan, currentLetterCount);

  return { customerEmail, selectedPlan, letterCount: currentLetterCount };
};

const handleCheckoutSession = async (db, session, transporter) => {
  console.log('Processing checkout session:', {
    id: session.id,
    customer_email: session.customer_email,
    customer_details: session.customer_details,
    payment_intent: session.payment_intent
  });

  if (!session.payment_intent) {
    throw new Error('No payment intent found in checkout session');
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
  
  // Add checkout session ID to payment intent metadata
  await stripe.paymentIntents.update(paymentIntent.id, {
    metadata: {
      ...paymentIntent.metadata,
      checkout_session_id: session.id
    }
  });

  return handlePaymentSuccess(db, paymentIntent, transporter);
};

const sendConfirmationEmail = async (transporter, customerEmail, selectedPlan, letterCount) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: customerEmail,
    subject: 'Payment Confirmation - Cover Letter Generator',
    html: `
      <h1>Thank you for your purchase!</h1>
      <p>Your payment has been successfully processed.</p>
      <p>Plan: ${selectedPlan}</p>
      <p>Available letter generations: ${letterCount}</p>
      <p>If you have any questions, please don't hesitate to contact us.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Confirmation email sent to:', customerEmail);
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    // Don't throw here - we don't want to fail the whole process if email fails
  }
};

const handleWebhook = async (req, endpointSecret, db, transporter) => {
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

module.exports = {
  handleWebhook
};
