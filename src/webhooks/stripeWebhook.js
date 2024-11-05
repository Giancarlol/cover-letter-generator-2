const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const getCustomerEmail = (paymentIntent) => {
  // Try all possible locations where email might be stored
  const email = 
    paymentIntent.receipt_email || 
    paymentIntent.customer_details?.email ||
    paymentIntent.metadata?.email ||
    (paymentIntent.customer && paymentIntent.customer.email);

  if (!email) {
    throw new Error('No customer email found in payment intent');
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
    metadata: paymentIntent.metadata
  });

  const customerEmail = getCustomerEmail(paymentIntent);
  console.log('Processing payment for customer:', customerEmail);

  let selectedPlan = 'Free Plan';
  let letterCount = 0;

  if (amount === 399) {
    selectedPlan = 'Basic Plan';
    letterCount = 5;
  } else if (amount === 999) {
    selectedPlan = 'Premium Plan';
    letterCount = 15;
  }

  console.log('Updating plan details:', { selectedPlan, letterCount, email: customerEmail });

  const updateResult = await users.updateOne(
    { email: customerEmail },
    {
      $set: {
        selectedPlan,
        letterCount,
        paymentStatus: 'completed',
        lastPaymentDate: new Date(),
        stripePaymentIntentId: paymentIntent.id
      }
    }
  );

  console.log('Update result:', updateResult);

  if (updateResult.matchedCount === 0) {
    throw new Error(`No user found with email: ${customerEmail}`);
  }

  if (updateResult.modifiedCount === 0) {
    throw new Error('Failed to update user plan');
  }

  await sendConfirmationEmail(transporter, customerEmail, selectedPlan, letterCount);

  return { customerEmail, selectedPlan, letterCount };
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

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Processing payment_intent.succeeded:', paymentIntent.id);
        const result = await handlePaymentSuccess(db, paymentIntent, transporter);
        console.log('Payment processed successfully:', result);
        break;
      
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Processing checkout.session.completed:', session.id);
        if (session.payment_intent) {
          const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
          const result = await handlePaymentSuccess(db, paymentIntent, transporter);
          console.log('Checkout session payment processed successfully:', result);
        }
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    return { success: true };
  } catch (error) {
    console.error('Webhook error:', error);
    throw error;
  }
};

module.exports = {
  handleWebhook
};