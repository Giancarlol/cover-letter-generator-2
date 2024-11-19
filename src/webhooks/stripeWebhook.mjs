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
  console.log('Starting handlePaymentSuccess with payment intent:', {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    status: paymentIntent.status,
    metadata: paymentIntent.metadata,
    customer: paymentIntent.customer
  });

  const users = db.collection('users');
  const amount = paymentIntent.amount;

  // Get the customer email
  const customerEmail = await getCustomerEmail(paymentIntent);
  console.log('Found customer email:', customerEmail);

  let selectedPlan = 'Free Plan';
  let letterCount = 0;
  let planDuration = 0; // in days

  // Setting the plan details based on the payment amount in cents
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
    console.error('Unrecognized payment amount:', amount);
    throw new Error(`Unrecognized payment amount: ${amount}`);
  }

  const subscriptionEndDate = new Date();
  subscriptionEndDate.setDate(subscriptionEndDate.getDate() + planDuration);

  // First, get the current user data
  console.log('Looking up user in database:', customerEmail);
  const currentUser = await users.findOne({ email: customerEmail });
  console.log('Current user data:', currentUser);

  if (!currentUser) {
    console.error('No user found for email:', customerEmail);
    throw new Error(`No user found with email: ${customerEmail}`);
  }

  // Prepare update data
  const updateData = {
    selectedPlan,
    letterCount,
    paymentStatus: 'completed',
    lastPaymentDate: new Date(),
    subscriptionEndDate,
    stripePaymentIntentId: paymentIntent.id,
    lastUpdated: new Date(),
    updateSource: 'webhook'
  };

  console.log('Attempting to update user plan with data:', updateData);

  try {
    // Use updateOne for direct update
    const updateResult = await users.updateOne(
      { email: customerEmail },
      { $set: updateData }
    );

    console.log('Database update result:', updateResult);

    if (updateResult.matchedCount === 0) {
      console.error('Update failed - no document matched');
      throw new Error('Failed to update user plan - no document matched');
    }

    if (updateResult.modifiedCount === 0) {
      console.error('Update failed - document matched but not modified');
      throw new Error('Failed to update user plan - document not modified');
    }

    // Get the updated user data
    const updatedUser = await users.findOne({ email: customerEmail });
    console.log('Updated user data:', updatedUser);

    // Verify the update was successful
    if (updatedUser.selectedPlan !== selectedPlan || updatedUser.letterCount !== letterCount) {
      console.error('Plan update verification failed:', {
        expected: { selectedPlan, letterCount },
        actual: { 
          selectedPlan: updatedUser.selectedPlan, 
          letterCount: updatedUser.letterCount 
        }
      });
      throw new Error('Plan update verification failed');
    }

    // Send confirmation email
    if (transporter) {
      try {
        await sendConfirmationEmail(transporter, customerEmail, selectedPlan, letterCount, subscriptionEndDate);
      } catch (error) {
        console.error('Failed to send confirmation email:', error);
        // Don't throw here, as the plan update was successful
      }
    }

    return { customerEmail, selectedPlan, letterCount };
  } catch (error) {
    console.error('Error updating user plan:', error);
    throw error;
  }
};

// Function to handle checkout session completion
const handleCheckoutSession = async (db, session, transporter) => {
  console.log('Starting handleCheckoutSession with session:', {
    id: session.id,
    customer_email: session.customer_email,
    payment_intent: session.payment_intent,
    amount_total: session.amount_total,
    metadata: session.metadata
  });

  if (!stripe) {
    console.error('Stripe is not initialized');
    throw new Error('Stripe is not initialized');
  }

  if (!session.payment_intent) {
    console.error('No payment intent found in session:', session.id);
    throw new Error('No payment intent found in checkout session');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
    console.log('Retrieved payment intent:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata
    });

    // Add session details to payment intent metadata
    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: {
        ...paymentIntent.metadata,
        checkout_session_id: session.id,
        customer_email: session.customer_email
      }
    });

    return handlePaymentSuccess(db, paymentIntent, transporter);
  } catch (error) {
    console.error('Error in handleCheckoutSession:', error);
    throw error;
  }
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
    throw error;
  }
};

// Main webhook handler function
const handleWebhook = async (req, endpointSecret, db, transporter) => {
  console.log('Webhook received:', {
    headers: req.headers,
    body: typeof req.body === 'string' ? 'raw string' : 'parsed object',
    timestamp: new Date().toISOString()
  });

  if (!stripe) {
    console.error('Stripe is not initialized - webhook handling skipped');
    return { success: true, result: null };
  }

  try {
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      console.error('No Stripe signature found in headers');
      throw new Error('No Stripe signature found');
    }

    if (!endpointSecret) {
      console.error('Webhook secret is not configured');
      throw new Error('Webhook secret is not configured');
    }

    console.log('Constructing webhook event...');
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('Webhook event constructed:', {
      type: event.type,
      id: event.id,
      timestamp: new Date(event.created * 1000).toISOString()
    });

    let result;

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Processing checkout.session.completed:', {
          sessionId: session.id,
          customerEmail: session.customer_email,
          amount: session.amount_total
        });
        result = await handleCheckoutSession(db, session, transporter);
        console.log('Checkout session processed successfully:', result);
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Processing payment_intent.succeeded:', {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          customerId: paymentIntent.customer
        });
        result = await handlePaymentSuccess(db, paymentIntent, transporter);
        console.log('Payment processed successfully:', result);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    return { success: true, result };
  } catch (error) {
    console.error('Webhook error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

export { handleWebhook };
