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
  console.log(`📧 [Wrong Password Alert] Starting for: ${email}`);
  try {
    const html = await getWrongPasswordEmail(email, attemptCount, req);
    console.log(`📧 [Wrong Password Alert] HTML generated, sending email...`);
    const result = await sendEmail(email, "⚠️ Security Alert: Failed Login Attempt", html);
    if (result) {
      console.log(`✅ [Wrong Password Alert] Sent successfully to ${email}`);
    } else {
      console.log(`❌ [Wrong Password Alert] Failed to send to ${email}`);
    }
  } catch (error) {
    console.error(`❌ [Wrong Password Alert] Error for ${email}:`, error.message);
  }
}

async function sendLoginNotification(email, req, isNewLocation = false) {
  console.log(`📧 [Login Notification] Starting for: ${email}, isNewLocation: ${isNewLocation}`);
  try {
    const html = await getLoginNotificationEmail(email, req, isNewLocation);
    console.log(`📧 [Login Notification] HTML generated, sending email...`);
    const result = await sendEmail(email, isNewLocation ? "🔐 New Login to Your Account" : "✅ Login Notification", html);
    if (result) {
      console.log(`✅ [Login Notification] Sent successfully to ${email}`);
    } else {
      console.log(`❌ [Login Notification] Failed to send to ${email}`);
    }
  } catch (error) {
    console.error(`❌ [Login Notification] Error for ${email}:`, error.message);
  }
}

async function sendExcessiveAttemptsAlert(email, attemptCount, req) {
  console.log(`📧 [Excessive Attempts Alert] Starting for: ${email}, attemptCount: ${attemptCount}`);
  try {
    const html = await getExcessiveAttemptsAlertEmail(email, attemptCount, req);
    console.log(`📧 [Excessive Attempts Alert] HTML generated, sending email...`);
    const result = await sendEmail(email, "🚨 Security Alert: Multiple Failed Login Attempts", html);
    if (result) {
      console.log(`✅ [Excessive Attempts Alert] Sent successfully to ${email}`);
    } else {
      console.log(`❌ [Excessive Attempts Alert] Failed to send to ${email}`);
    }
  } catch (error) {
    console.error(`❌ [Excessive Attempts Alert] Error for ${email}:`, error.message);
  }
}

async function sendWelcomeEmailMessage(name, email) {
  console.log(`📧 [Welcome Email] Starting for: ${email}, name: ${name}`);
  try {
    const html = await getWelcomeEmail(name, email);
    console.log(`📧 [Welcome Email] HTML generated, sending email...`);
    const result = await sendEmail(email, "🎉 Welcome to Business Manager! Let's Get Started", html);
    if (result) {
      console.log(`✅ [Welcome Email] Sent successfully to ${email}`);
    } else {
      console.log(`❌ [Welcome Email] Failed to send to ${email}`);
    }
  } catch (error) {
    console.error(`❌ [Welcome Email] Error for ${email}:`, error.message);
  }
}

async function sendOTPEmail(email, otp) {
  console.log(`📧 [OTP Email] Starting for: ${email}, OTP: ${otp}`);
  try {
    const html = await getOTPEmail(email, otp);
    console.log(`📧 [OTP Email] HTML generated, sending email...`);
    const result = await sendEmail(email, "🔐 Email Verification Code - Business Manager", html);
    if (result) {
      console.log(`✅ [OTP Email] Sent successfully to ${email}`);
    } else {
      console.log(`❌ [OTP Email] Failed to send to ${email}`);
    }
  } catch (error) {
    console.error(`❌ [OTP Email] Error for ${email}:`, error.message);
  }
}

async function sendPasswordResetOTP(email, name, otp) {
  console.log(`📧 [Password Reset OTP] Starting for: ${email}, name: ${name}, OTP: ${otp}`);
  try {
    const html = await getPasswordResetOTPEmail(email, name, otp);
    console.log(`📧 [Password Reset OTP] HTML generated, sending email...`);
    const result = await sendEmail(email, "🔐 Password Reset OTP - Business Manager", html);
    if (result) {
      console.log(`✅ [Password Reset OTP] Sent successfully to ${email}`);
    } else {
      console.log(`❌ [Password Reset OTP] Failed to send to ${email}`);
    }
  } catch (error) {
    console.error(`❌ [Password Reset OTP] Error for ${email}:`, error.message);
  }
}

async function sendPasswordChangedConfirmation(email, name) {
  console.log(`📧 [Password Changed Confirmation] Starting for: ${email}, name: ${name}`);
  try {
    const html = await getPasswordChangedConfirmationEmail(email, name);
    console.log(`📧 [Password Changed Confirmation] HTML generated, sending email...`);
    const result = await sendEmail(email, "✅ Password Changed Successfully - Business Manager", html);
    if (result) {
      console.log(`✅ [Password Changed Confirmation] Sent successfully to ${email}`);
    } else {
      console.log(`❌ [Password Changed Confirmation] Failed to send to ${email}`);
    }
  } catch (error) {
    console.error(`❌ [Password Changed Confirmation] Error for ${email}:`, error.message);
  }
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