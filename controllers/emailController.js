// backend/controllers/emailController.js
const { sendEmail } = require("../services/emailService");
const {
  getWrongPasswordEmail,
  getLoginNotificationEmail,
  getWelcomeEmail,
  getOTPEmail,
  getPasswordResetOTPEmail,
  getPasswordChangedConfirmationEmail,
  getExcessiveAttemptsAlertEmail,
} = require("../utils/emailTemplates");

async function sendWrongPasswordAlert(email, attemptCount, req) {
  const html = await getWrongPasswordEmail(email, attemptCount, req);
  await sendEmail(email, "⚠️ Security Alert: Failed Login Attempt", html);
}

async function sendLoginNotification(email, req, isNewLocation = false) {
  const html = await getLoginNotificationEmail(email, req, isNewLocation);
  await sendEmail(email, isNewLocation ? "🔐 New Login to Your Account" : "✅ Login Notification", html);
}

async function sendExcessiveAttemptsAlert(email, attemptCount, req) {
  const html = await getExcessiveAttemptsAlertEmail(email, attemptCount, req);
  await sendEmail(email, "🚨 Security Alert: Multiple Failed Login Attempts", html);
}

async function sendWelcomeEmailMessage(name, email) {
  const html = await getWelcomeEmail(name, email);
  await sendEmail(email, "🎉 Welcome to Business Manager! Let's Get Started", html);
}

async function sendOTPEmail(email, otp) {
  const html = await getOTPEmail(email, otp);
  await sendEmail(email, "🔐 Email Verification Code - Business Manager", html);
}

async function sendPasswordResetOTP(email, name, otp) {
  const html = await getPasswordResetOTPEmail(email, name, otp);
  await sendEmail(email, "🔐 Password Reset OTP - Business Manager", html);
}

async function sendPasswordChangedConfirmation(email, name) {
  const html = await getPasswordChangedConfirmationEmail(email, name);
  await sendEmail(email, "✅ Password Changed Successfully - Business Manager", html);
}

module.exports = {
  sendWrongPasswordAlert,
  sendLoginNotification,
  sendExcessiveAttemptsAlert,
  sendWelcomeEmailMessage,
  sendOTPEmail,
  sendPasswordResetOTP,
  sendPasswordChangedConfirmation,
};