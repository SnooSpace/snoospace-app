/**
 * razorpayClient.js
 * Single shared Razorpay instance — initialised once at startup.
 * Reads credentials from environment — never hardcoded.
 * Import this wherever you need to call the Razorpay API.
 */

const Razorpay = require('razorpay');

const razorpayClient = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = razorpayClient;
