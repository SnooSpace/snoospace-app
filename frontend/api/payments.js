/**
 * payments.js — Frontend API calls for Razorpay payment flow
 *
 * Flow for paid tickets:
 *  1. createPaymentOrder(eventId, totalAmountRupees)
 *     → Backend creates a Razorpay order, returns orderId + keyId
 *  2. Open Razorpay payment sheet with RazorpayCheckout.open(options)
 *     → User completes payment (card / UPI / netbanking / wallet)
 *  3. verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature })
 *     → Backend verifies HMAC signature (optimistic check)
 *  4. getPaymentStatus(eventId)
 *     → Poll or check for webhook-confirmed registration
 *
 * The authoritative registration happens via the Razorpay webhook on the backend.
 * verifyPayment is a secondary client-side check — do NOT assume registration
 * is complete until payment_status === 'captured' or registration_status === 'registered'.
 */

import { apiPost, apiGet } from './client';

/**
 * Step 1: Create a Razorpay order before opening the payment sheet.
 * Call this when user taps "Pay Now" on the checkout screen.
 *
 * @param {number|string} eventId - The event to register for
 * @param {number} totalAmountRupees - Final amount in rupees (after discounts)
 * @returns {Promise<{
 *   success: boolean,
 *   orderId: string,       // Razorpay order ID (order_xxx)
 *   amount: number,        // Amount in paise
 *   currency: string,      // 'INR'
 *   keyId: string,         // Razorpay public key (safe to use in frontend)
 *   eventTitle: string,
 *   receipt: string,
 *   prefill: { name, email, contact }
 * }>}
 */
export async function createPaymentOrder(eventId, totalAmountRupees) {
  const token = await (await import('./auth')).getAuthToken();
  return apiPost('/payments/create-order', { eventId, totalAmountRupees }, 15000, token);
}

/**
 * Step 3: Verify the payment signature after Razorpay sheet closes with success.
 * This is an optimistic secondary check — actual registration is confirmed by webhook.
 *
 * @param {{
 *   razorpay_order_id: string,
 *   razorpay_payment_id: string,
 *   razorpay_signature: string
 * }} paymentData - The object returned by RazorpayCheckout.open()
 * @returns {Promise<{ success: boolean, status: string, message: string }>}
 */
export async function verifyPayment(paymentData) {
  const token = await (await import('./auth')).getAuthToken();
  return apiPost('/payments/verify', paymentData, 15000, token);
}

/**
 * Check payment status for the current user for a specific event.
 * Use after verifyPayment to poll until webhook_verified = true.
 *
 * @param {number|string} eventId
 * @returns {Promise<{
 *   status: 'not_paid' | 'found',
 *   payment_status?: 'captured' | 'failed' | 'refunded',
 *   registration_status?: string,
 *   captured_at?: string,
 *   amount_paise?: number,
 *   payment_method?: string
 * }>}
 */
export async function getPaymentStatus(eventId) {
  const token = await (await import('./auth')).getAuthToken();
  return apiGet(`/payments/status/${eventId}`, 10000, token);
}
