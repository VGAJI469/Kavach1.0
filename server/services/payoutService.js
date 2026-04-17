const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Initiates a UPI payout in Razorpay test mode.
 * Returns { status: 'created'|'failed', utr?: string, error?: string }
 */
async function initiatePayout({ amount, upiId, accountNumber }) {
  try {
    const payout = await razorpay.payments.create({
      amount: Math.round(amount * 100), // amount in paise
      currency: 'INR',
      method: 'upi',
      upi_id: upiId,
      notes: { account_number: accountNumber },
    });
    // In test mode Razorpay returns a mock UTR immediately
    return { status: 'created', utr: payout.id || 'test_utr_12345' };
  } catch (err) {
    console.error('[PayoutService] Razorpay error:', err);
    return { status: 'failed', error: err.message || 'unknown' };
  }
}

module.exports = { initiatePayout };
