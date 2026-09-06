/**
 * razorpayRefundExecutor.js
 *
 * Single-responsibility utility: execute a refund via the Razorpay API.
 *
 * Extracted from financialController.approveRefundRequest so the same
 * Razorpay call can be reused by both:
 *   - Admin manual approval  (financialController.approveRefundRequest)
 *   - System auto-refund     (eventCancellationService.cancelEventWithRefunds)
 *
 * Returns the Razorpay refund object on success, throws on failure.
 * Callers are responsible for creating/updating refund_requests rows.
 */

const razorpay = require('./razorpayClient');

/**
 * Execute a Razorpay refund.
 *
 * @param {string} razorpayPaymentId  - The payment ID to refund (pay_xxx)
 * @param {number} amountRupees       - Amount to refund in RUPEES (will be converted to paise)
 * @param {Object} notes              - Key-value notes attached to the refund in Razorpay dashboard
 * @returns {Promise<Object>}         - Razorpay refund entity (id, amount, status, …)
 * @throws                            - Razorpay API error or network error
 */
const executeRazorpayRefund = async (razorpayPaymentId, amountRupees, notes = {}) => {
  const amountPaise = Math.round(amountRupees * 100);

  if (amountPaise <= 0) {
    throw new Error(`Invalid refund amount: ₹${amountRupees} → ${amountPaise} paise (must be > 0)`);
  }

  const refund = await razorpay.payments.refund(razorpayPaymentId, {
    amount: amountPaise,
    notes,
  });

  return refund;
};

module.exports = { executeRazorpayRefund };
