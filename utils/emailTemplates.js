// backend/utils/emailTemplates.js
const { getDeviceInfo } = require("../services/deviceService");
const { getLocationFromIP } = require("../services/locationService");

// Common footer for all emails (helps with spam prevention)
const getCommonFooter = () => {
  const currentYear = new Date().getFullYear();
  return `
    <div style="text-align: center; margin-top: 30px; padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
      <p style="color:#6b7280; font-size:12px; margin:0 0 10px 0;">
        <strong>Business Manager</strong><br>
        123 Business Street, Suite 100<br>
        Mumbai, Maharashtra 400001, India
      </p>
      <p style="color:#9ca3af; font-size:11px; margin:10px 0;">
        This is an automated transactional email from your Business Manager account.<br>
        If you didn't request this email, you can safely ignore it.
      </p>
      <p style="color:#cbd5e1; font-size:10px; margin:10px 0;">
        &copy; ${currentYear} Business Manager. All rights reserved.
      </p>
    </div>
  `;
};

// Wrong Password Email Template
async function getWrongPasswordEmail(email, attemptCount, req) {
  const location = await getLocationFromIP(req);
  const device = getDeviceInfo(req.headers['user-agent']);
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip;
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
  const time = new Date().toLocaleString();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Security Alert - Failed Login Attempt</title>
<style>
  body { margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .container { max-width:560px; width:100%; background-color:#ffffff; border-radius:16px; overflow:hidden; }
  .header { background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding:40px 30px; text-align:center; }
  .content { padding:40px 30px; }
  .footer { background-color:#f9fafb; padding:20px; text-align:center; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);padding:40px 30px;text-align:center;">
<h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">⚠️ Security Alert</h1>
<p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;">Failed Login Attempt Detected</p>
</td></tr>
<tr><td style="padding:40px 30px;">
<p style="color:#1f2937;font-size:16px;margin-bottom:20px;">Hello <strong>${email.split('@')[0]}</strong>,</p>
<p style="color:#4b5563;font-size:15px;line-height:24px;margin-bottom:25px;">We detected a <strong style="color:#dc2626;">failed login attempt</strong> on your Business Manager account. This is attempt #${attemptCount} with incorrect password.</p>
<div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:25px;border:1px solid #e5e7eb;">
<h3 style="color:#374151;font-size:16px;margin:0 0 15px 0;">📍 Login Details:</h3>
<table width="100%" style="font-size:14px;">
<tr><td style="padding:8px 0;color:#6b7280;">Time:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${time}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">IP Address:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${ip}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">Location:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${location.city}, ${location.country}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">ISP:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${location.isp || 'Unknown'}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">Device:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${device.device}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">OS:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${device.os}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">Browser:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${device.browser}</td></tr>
</table>
</div>
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;margin-bottom:25px;border-radius:8px;">
<p style="color:#92400e;font-size:13px;margin:0;"><strong>🔒 What to do:</strong> If this wasn't you, please secure your account immediately by changing your password.</p>
</div>
${getCommonFooter()}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Login Notification Email Template
async function getLoginNotificationEmail(email, req, isNewLocation) {
  const location = await getLocationFromIP(req);
  const device = getDeviceInfo(req.headers['user-agent']);
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip;
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
  const time = new Date().toLocaleString();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${isNewLocation ? "New Login Detected" : "Login Notification"}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);padding:40px 30px;text-align:center;">
<h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">${isNewLocation ? "🔐 New Login Detected" : "✅ Successful Login"}</h1>
<p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;">${isNewLocation ? "We noticed a login from a new device/location" : "You've successfully signed in to your account"}</p>
</td></tr>
<tr><td style="padding:40px 30px;">
<p style="color:#1f2937;font-size:16px;margin-bottom:20px;">Hello <strong>${email.split('@')[0]}</strong>,</p>
<p style="color:#4b5563;font-size:15px;line-height:24px;margin-bottom:25px;">${isNewLocation ? "We detected a sign-in to your account from a new device or location. If this was you, no further action is needed." : "Your account was successfully accessed. Here are the login details:"}</p>
<div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:25px;border:1px solid #e5e7eb;">
<h3 style="color:#374151;font-size:16px;margin:0 0 15px 0;">📍 Login Information:</h3>
<table width="100%" style="font-size:14px;">
<tr><td style="padding:8px 0;color:#6b7280;">Time:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${time}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">IP Address:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${ip}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">Location:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">📍 ${location.city}, ${location.country}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">ISP:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${location.isp || 'Unknown'}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">Device:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${device.device}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">Operating System:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${device.os}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">Browser:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${device.browser}</td></tr>
</table>
</div>
${getCommonFooter()}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Welcome Email Template
async function getWelcomeEmail(name, email) {
  const currentYear = new Date().getFullYear();
  
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Business Manager</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:20px;box-shadow:0 20px 35px -10px rgba(0,0,0,0.1);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);padding:50px 30px 40px;text-align:center;">
<h1 style="color:#ffffff;font-size:32px;font-weight:700;margin:0;">Welcome Aboard! 🎉</h1>
<p style="color:rgba(255,255,255,0.95);font-size:18px;margin:10px 0 0 0;">Your journey with Business Manager begins now</p>
</td></tr>
<tr><td style="padding:40px 35px;">
<h2 style="color:#1f2937;font-size:24px;margin:0 0 10px;">Congratulations, ${name.split(' ')[0]}! 🎊</h2>
<p style="color:#4b5563;font-size:16px;line-height:26px;margin-bottom:25px;">
Thank you for choosing <strong style="color:#667eea;">Business Manager</strong>. Your account has been successfully created.
</p>
<p style="color:#4b5563;font-size:15px;line-height:24px;margin-bottom:25px;">
<strong>To ensure you receive all our emails, please add <span style="color:#667eea;">work.nitishrajbhar@gmail.com</span> to your address book.</strong>
</p>
<div style="background:linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%);border-radius:16px;padding:25px;margin-bottom:25px;border:1px solid #e5e7eb;">
<h3 style="color:#374151;font-size:18px;margin:0 0 15px;">✨ What you can do now:</h3>
<table width="100%" style="font-size:15px;">
<tr><td style="padding:8px 0;"><span style="color:#10b981;font-weight:bold;">✓</span> Manage your company profile</td></tr>
<tr><td style="padding:8px 0;"><span style="color:#10b981;font-weight:bold;">✓</span> Track employee attendance</td></tr>
<tr><td style="padding:8px 0;"><span style="color:#10b981;font-weight:bold;">✓</span> Generate invoices and billing</td></tr>
<tr><td style="padding:8px 0;"><span style="color:#10b981;font-weight:bold;">✓</span> Access real-time analytics</td></tr>
</table>
</div>
<div style="text-align:center;margin-bottom:25px;">
<a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="display:inline-block;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;text-decoration:none;padding:14px 35px;border-radius:10px;font-weight:600;">🚀 Go to Dashboard</a>
</div>
${getCommonFooter()}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// OTP Email Template
async function getOTPEmail(email, otp) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Email Verification</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 30px;text-align:center;">
<h1 style="color:#fff;font-size:28px;margin:0;">Verify Your Email</h1>
</td></tr>
<tr><td style="padding:40px 30px;">
<p>Hello <strong>${email.split('@')[0]}</strong>,</p>
<p>Please use the verification code below to complete your registration. This code is valid for <strong>5 minutes</strong>.</p>
<div style="background:#f3f4f6;border-radius:12px;padding:30px;text-align:center;">
<div style="background:#fff;border-radius:8px;padding:15px;display:inline-block;">
<p style="font-size:48px;font-weight:800;color:#667eea;margin:0;letter-spacing:8px;">${otp}</p>
</div>
</div>
${getCommonFooter()}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Password Reset OTP Email Template
async function getPasswordResetOTPEmail(email, name, otp) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Password Reset OTP</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 30px;text-align:center;">
<h1 style="color:#fff;font-size:28px;margin:0;">🔐 Password Reset</h1>
</td></tr>
<tr><td style="padding:40px 30px;">
<p>Hello <strong>${name}</strong>,</p>
<p>We received a request to reset your password. Please use the verification code below to proceed.</p>
<div style="background:#f3f4f6;border-radius:12px;padding:30px;text-align:center;margin:25px 0;">
<div style="background:#fff;border-radius:8px;padding:15px;display:inline-block;">
<p style="font-size:48px;font-weight:800;color:#667eea;margin:0;letter-spacing:8px;">${otp}</p>
</div>
</div>
<p style="color:#6b7280;font-size:13px;">This code will expire in <strong>15 minutes</strong>.</p>
${getCommonFooter()}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Password Changed Confirmation Email Template
async function getPasswordChangedConfirmationEmail(email, name) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Password Changed Successfully</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:40px 30px;text-align:center;">
<h1 style="color:#fff;font-size:28px;margin:0;">✅ Password Changed!</h1>
<p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;">Your password has been successfully updated</p>
</td></tr>
<tr><td style="padding:40px 30px;">
<p>Hello <strong>${name}</strong>,</p>
<p>Your Business Manager account password was successfully changed on <strong>${new Date().toLocaleString()}</strong>.</p>
<div style="background:#dbeafe;border-radius:12px;padding:20px;margin:25px 0;">
<p style="color:#1e40af;margin:0;">If you made this change, no further action is needed.</p>
</div>
${getCommonFooter()}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Excessive Attempts Alert Email Template
async function getExcessiveAttemptsAlertEmail(email, attemptCount, req) {
  const location = await getLocationFromIP(req);
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip;
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Security Alert: Multiple Failed Attempts</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:40px 30px;text-align:center;">
<h1 style="color:#fff;font-size:24px;margin:0;">🚨 Multiple Failed Attempts</h1>
<p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;">Your account has been temporarily locked</p>
</td></tr>
<tr><td style="padding:40px 30px;">
<p>Hello <strong>${email.split('@')[0]}</strong>,</p>
<div style="background:#fee2e2;border-radius:12px;padding:20px;margin-bottom:25px;border:1px solid #fecaca;">
<p style="color:#991b1b;margin:0;"><strong>⚠️ Critical Security Alert</strong><br>Your account has been temporarily locked due to ${attemptCount} failed login attempts.</p>
</div>
<p style="color:#4b5563;margin-bottom:20px;">This could indicate someone is trying to access your account without authorization.</p>
<div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:25px;">
<h3 style="margin:0 0 15px 0;">Attempt Details:</h3>
<table width="100%">
<tr><td style="padding:8px 0;">Total Attempts:</td><td style="padding:8px 0;color:#dc2626;font-weight:700;">${attemptCount}</td></tr>
<tr><td style="padding:8px 0;">IP Address:</td><td style="padding:8px 0;font-weight:500;">${ip}</td></tr>
<tr><td style="padding:8px 0;">Location:</td><td style="padding:8px 0;font-weight:500;">${location.city}, ${location.country}</td></tr>
</table>
</div>
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;">
<p style="color:#92400e;margin:0;"><strong>🔒 Recommended Actions:</strong><br>1. Change your password immediately<br>2. Review recent account activity<br>3. Contact support</p>
</div>
${getCommonFooter()}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

module.exports = {
  getWrongPasswordEmail,
  getLoginNotificationEmail,
  getWelcomeEmail,
  getOTPEmail,
  getPasswordResetOTPEmail,
  getPasswordChangedConfirmationEmail,
  getExcessiveAttemptsAlertEmail,
};