const express = require('express');
const cors = require('cors');
const stripe = require('stripe')('sk_test_4eC39HqLyjWDarjtT1zdp7dc'); // Replace with your actual secret key

const app = express();
app.use(cors()); // Enable CORS to allow requests from different domains
app.use(express.json()); // To parse JSON requests

const YOUR_DOMAIN = 'http://localhost:3000'; // Your React app domain

app.post('/create-checkout-session', async (req, res) => {
    try {
        // Create a Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'T-shirt',
                    },
                    unit_amount: 2000, // Amount in cents ($20.00)
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${YOUR_DOMAIN}/success`,
            cancel_url: `${YOUR_DOMAIN}/cancel`,
        });

        res.json({ id: session.id });
    } catch (error) {
        res.status(403).json({ error: error.message });
    }
});

app.listen(5000, () => console.log('Server running on port 5000'));
