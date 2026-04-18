/**
 * Email Service
 *
 * Uses Resend.com for sending transactional emails
 * Requires RESEND_API_KEY environment variable
 */

// Check if Resend is available (optional dependency)
let resend = null;
try {
  const { Resend } = require("resend");
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
} catch (e) {
  console.log("Resend not installed - email features disabled");
}

/**
 * Check if email service is configured
 */
function isEmailEnabled() {
  return resend !== null;
}

/**
 * Generate QR code URL using free API
 * @param {string} data - Data to encode in QR code
 * @param {number} size - Size in pixels (default 200)
 */
function getQrCodeUrl(data, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    data
  )}`;
}

/**
 * Send booking confirmation email
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.memberName - Member's name
 * @param {string} params.eventTitle - Event title
 * @param {Date} params.eventDate - Event date
 * @param {string} params.eventLocation - Event location
 * @param {Array} params.tickets - Array of {ticketName, quantity, unitPrice}
 * @param {string} params.qrCodeHash - Unique QR code hash for entry
 * @param {number} params.totalAmount - Total amount paid
 */
async function sendBookingConfirmationEmail({
  to,
  memberName,
  eventTitle,
  eventDate,
  eventLocation,
  tickets,
  qrCodeHash,
  totalAmount,
}) {
  if (!isEmailEnabled()) {
    console.log("Email service not configured - skipping confirmation email");
    return { success: false, reason: "email_not_configured" };
  }

  try {
    const ticketList = tickets
      .map((t) => `${t.quantity}x ${t.ticketName}`)
      .join(", ");

    const formattedDate = new Date(eventDate).toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const qrCodeUrl = getQrCodeUrl(qrCodeHash);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #1F2937; margin: 0 0 24px 0; font-size: 28px;">🎉 Booking Confirmed!</h1>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi ${memberName},</p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">
      Your tickets for <strong>${eventTitle}</strong> have been confirmed!
    </p>
    
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin: 24px 0; color: white;">
      <h2 style="margin: 0 0 16px 0; font-size: 20px;">${eventTitle}</h2>
      <p style="margin: 0 0 8px 0; opacity: 0.9;">📅 ${formattedDate}</p>
      ${
        eventLocation
          ? `<p style="margin: 0 0 8px 0; opacity: 0.9;">📍 ${eventLocation}</p>`
          : ""
      }
      <p style="margin: 16px 0 0 0;">🎫 ${ticketList}</p>
    </div>
    
    <div style="background: #F3F4F6; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #6B7280;">Order Total</span>
        <span style="color: #1F2937; font-weight: 600;">₹${totalAmount.toLocaleString(
          "en-IN"
        )}</span>
      </div>
    </div>
    
    <div style="text-align: center; margin: 32px 0; padding: 24px; background: #FAFAFA; border-radius: 12px;">
      <p style="color: #6B7280; margin: 0 0 16px 0; font-size: 14px;">Show this QR code at entry:</p>
      <img src="${qrCodeUrl}" alt="QR Code" style="border-radius: 8px; max-width: 200px;" />
      <p style="font-family: monospace; font-size: 11px; color: #9CA3AF; margin: 12px 0 0 0; word-break: break-all;">${qrCodeHash}</p>
    </div>
    
    <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
      You can also find your ticket in the SnooSpace app under <strong>"Your Events"</strong> → <strong>"Going"</strong>.
    </p>
    
    <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;" />
    
    <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
      This email was sent by SnooSpace. If you didn't book this ticket, please contact us.
    </p>
  </div>
</body>
</html>
    `;

    const result = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL || "SnooSpace <tickets@snoospace.com>",
      to,
      subject: `🎟️ Your tickets for ${eventTitle} are confirmed!`,
      html,
    });

    console.log("Confirmation email sent:", result);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error("Failed to send confirmation email:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send cancellation confirmation email
 * @param {Object} params - Email parameters
 */
async function sendCancellationEmail({
  to,
  memberName,
  eventTitle,
  refundAmount,
}) {
  if (!isEmailEnabled()) {
    console.log("Email service not configured - skipping cancellation email");
    return { success: false, reason: "email_not_configured" };
  }

  try {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #1F2937; margin: 0 0 24px 0; font-size: 28px;">Booking Cancelled</h1>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi ${memberName},</p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">
      Your booking for <strong>${eventTitle}</strong> has been cancelled.
    </p>
    
    ${
      refundAmount > 0
        ? `
    <div style="background: #ECFDF5; border: 1px solid #10B981; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <p style="color: #065F46; margin: 0; font-size: 16px;">
        💰 Refund of <strong>₹${refundAmount.toLocaleString(
          "en-IN"
        )}</strong> will be processed within 5-7 business days.
      </p>
    </div>
    `
        : `
    <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <p style="color: #92400E; margin: 0; font-size: 14px;">
        Based on the event's refund policy, no refund is applicable for this cancellation.
      </p>
    </div>
    `
    }
    
    <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
      If you have any questions, please contact the event organizer.
    </p>
    
    <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;" />
    
    <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
      This email was sent by SnooSpace.
    </p>
  </div>
</body>
</html>
    `;

    const result = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL || "SnooSpace <tickets@snoospace.com>",
      to,
      subject: `Booking cancelled: ${eventTitle}`,
      html,
    });

    console.log("Cancellation email sent:", result);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error("Failed to send cancellation email:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  isEmailEnabled,
  sendBookingConfirmationEmail,
  sendCancellationEmail,
  getQrCodeUrl,
};
