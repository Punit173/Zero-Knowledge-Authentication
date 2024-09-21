import React from 'react';
import { Link } from 'react-router-dom';
import './ZeroKnowledgeAuth.css'; // Assuming you have a CSS file for consistent styling

const Cancel = () => {
  return (
    <div className="container">
      <div className="form-wrapper">
        <h2 className="title">Payment Cancelled</h2>
        <p>It seems like your payment was cancelled. If this was a mistake, you can try again below.</p>
        
        <Link to="/paymentgateway">
          <button className="button_gen">Retry Payment</button>
        </Link>

        <Link to="/">
          <button className="button_gen">Back to Home</button>
        </Link>
      </div>
    </div>
  );
};

export default Cancel;
