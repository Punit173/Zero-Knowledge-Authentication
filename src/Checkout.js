import React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe('pk_test_TYooMQauvdEDq54NiTphI7jx');  // Replace with your publishable key

const Checkout = () => {
  const handleCheckout = async () => {
    const stripe = await stripePromise;

    // Call your Flask backend to create a Checkout Session
    const response = await axios.post('http://localhost:5000/create-checkout-session');

    const sessionId = response.data.id;

    // Redirect the user to Stripe Checkout
    const { error } = await stripe.redirectToCheckout({
      sessionId,
    });

    if (error) {
      console.error('Stripe Checkout error:', error);
    }
  };

  return (
    <div>
      <h1>Buy a T-shirt for $20</h1>
      <button onClick={handleCheckout}>Checkout</button>
    </div>
  );
};

export default Checkout;
