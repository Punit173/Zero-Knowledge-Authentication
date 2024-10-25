import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';
import './ZeroKnowledgeAuth.css'; // Assuming you want to apply similar CSS
import { Link } from 'react-router-dom';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe('pk_test_TYooMQauvdEDq54NiTphI7jx'); // Replace with your publishable key

const Checkout = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const stripe = await stripePromise;

      // Call your Flask backend to create a Checkout Session
      const response = await axios.post('http://localhost:5000/create-checkout-session');
      const sessionId = response.data.id;

      // Redirect the user to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        console.error('Stripe Checkout error:', error);
        setError('Failed to redirect to checkout.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Failed to initiate checkout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="form-wrapper">
        <h2 className="title">Exchange Currency</h2>
        <p>Click the button below to proceed.</p>
        <img height={200} src='https://cdn.pixabay.com/photo/2021/11/05/12/22/dollars-6771261_960_720.jpg'></img>
        <button
          className="button_gen"
          onClick={handleCheckout}
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Proceed'}
        </button>

        {error && <p className="error-message">{error}</p>}

        <Link to="/">
          <button className="button_gen">Back to Home</button>
        </Link>
      </div>
    </div>
  );
};

export default Checkout;
