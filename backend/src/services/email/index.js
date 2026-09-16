const logger = require("../../utils/logger");

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@leetcoach.ai";

async function sendVerificationEmail(email, token) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

  if (process.env.NODE_ENV !== "production") {
    logger.info(`[Email Verification] ${email}: ${verifyUrl}`);
    return { sent: true, preview: verifyUrl };
  }

  // Production: use SMTP (configure via EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS)
  // For now, log and succeed — plug in nodemailer or SendGrid when ready
  logger.info(`[Email Verification] Sending to ${email}`);
  return { sent: true };
}

async function sendPasswordResetEmail(email, resetUrl) {
  if (process.env.NODE_ENV !== "production") {
    logger.info(`[Password Reset] ${email}: ${resetUrl}`);
    return { sent: true, preview: resetUrl };
  }

  logger.info(`[Password Reset] Sending to ${email}`);
  return { sent: true };
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, FROM_EMAIL };
