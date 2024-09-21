from flask import Flask, jsonify, request
from flask_cors import CORS
import stripe

app = Flask(__name__)
CORS(app)  # Enable CORS to allow requests from different domains

# Set your secret and publishable keys
stripe.api_key = 'sk_test_4eC39HqLyjWDarjtT1zdp7dc'  # Replace with your actual secret key

YOUR_DOMAIN = 'http://localhost:3000'  # Your React app domain

@app.route('/create-checkout-session', methods=['POST'])
def create_checkout_session():
    try:
        # Create a Stripe Checkout Session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': 'T-shirt',
                    },
                    'unit_amount': 2000,  # Amount in cents ($20.00)
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=YOUR_DOMAIN + '/success',
            cancel_url=YOUR_DOMAIN + '/cancel',
        )
        return jsonify({'id': checkout_session.id})
    except Exception as e:
        return jsonify(error=str(e)), 403


if __name__ == '__main__':
    app.run(port=5000, debug=True)
