// backend/utils/emailTemplates.js
const { getDeviceInfo } = require("../services/deviceService");
const { getLocationFromIP } = require("../services/locationService");

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
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);padding:40px 30px;text-align:center;">
<h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:20px 0 0 0;">⚠️ Security Alert</h1>
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
<hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">
<p style="color:#6b7280;font-size:13px;text-align:center;">If this was you, you can ignore this message.</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px;text-align:center;">
<p style="color:#9ca3af;font-size:12px;margin:0;">© 2024 Business Manager. All rights reserved.<br>This is an automated security notification.</p>
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
<title>${isNewLocation ? "New Login Detected" : "Login Notification"}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);padding:40px 30px;text-align:center;">
<h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:20px 0 0 0;">${isNewLocation ? "🔐 New Login Detected" : "✅ Successful Login"}</h1>
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
<hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">
<p style="color:#6b7280;font-size:13px;text-align:center;">If you didn't perform this login, please contact support immediately.</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px;text-align:center;">
<p style="color:#9ca3af;font-size:12px;margin:0;">© 2024 Business Manager. All rights reserved.<br>This is an automated security notification.</p>
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
<h1 style="color:#ffffff;font-size:32px;font-weight:700;margin:0 0 10px;">Welcome Aboard! 🎉</h1>
<p style="color:rgba(255,255,255,0.95);font-size:18px;margin:0;">Your journey with Business Manager begins now</p>
</td></tr>
<tr><td style="padding:40px 35px;">
<h2 style="color:#1f2937;font-size:24px;margin:0 0 10px;">Congratulations, ${name.split(' ')[0]}! 🎊</h2>
<p style="color:#4b5563;font-size:16px;line-height:26px;margin-bottom:25px;">
Thank you for choosing <strong style="color:#667eea;">Business Manager</strong>. Your account has been successfully created and you're now ready to streamline your workforce management.
</p>
<div style="background:linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%);border-radius:16px;padding:25px;margin-bottom:25px;border:1px solid #e5e7eb;">
<h3 style="color:#374151;font-size:18px;margin:0 0 15px;">✨ What you can do now:</h3>
<table width="100%" style="font-size:15px;">
<tr><td style="padding:8px 0;"><span style="color:#10b981;font-weight:bold;">✓</span> Manage your company profile</td></tr>
<tr><td style="padding:8px 0;"><span style="color:#10b981;font-weight:bold;">✓</span> Track employee attendance</td></tr>
<tr><td style="padding:8px 0;"><span style="color:#10b981;font-weight:bold;">✓</span> Generate invoices and billing</td></tr>
<tr><td style="padding:8px 0;"><span style="color:#10b981;font-weight:bold;">✓</span> Access real-time analytics</td></tr>
<tr><td style="padding:8px 0;"><span style="color:#10b981;font-weight:bold;">✓</span> 24/7 customer support</td></tr>
</table>
</div>
<div style="background:#fef3c7;border-radius:12px;padding:20px;margin-bottom:25px;border-left:4px solid #f59e0b;">
<h4 style="color:#92400e;font-size:14px;margin:0 0 10px;">📋 Account Details:</h4>
<table width="100%" style="font-size:14px;">
<tr><td style="padding:5px 0;color:#6b7280;">Name:</td><td style="padding:5px 0;color:#1f2937;font-weight:500;">${name}</td></tr>
<tr><td style="padding:5px 0;color:#6b7280;">Email:</td><td style="padding:5px 0;color:#1f2937;font-weight:500;">${email}</td></tr>
<tr><td style="padding:5px 0;color:#6b7280;">Registered on:</td><td style="padding:5px 0;color:#1f2937;font-weight:500;">${new Date().toLocaleDateString()}</td></tr>
</table>
</div>
<div style="background:#dbeafe;border-radius:12px;padding:20px;margin-bottom:25px;">
<h4 style="color:#1e40af;font-size:14px;margin:0 0 10px;">💡 Quick Tips to Get Started:</h4>
<ul style="color:#1e3a8a;font-size:13px;line-height:20px;margin:0;padding-left:20px;">
<li>Complete your company profile in Settings</li>
<li>Add your team members and assign roles</li>
<li>Set up your GST and tax details for invoicing</li>
<li>Explore the dashboard to see key metrics</li>
</ul>
</div>
<div style="text-align:center;margin-bottom:25px;">
<a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="display:inline-block;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;text-decoration:none;padding:14px 35px;border-radius:10px;font-weight:600;margin:0 5px;box-shadow:0 4px 15px rgba(102,126,234,0.3);">
🚀 Go to Dashboard
</a>
<a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/company-details" style="display:inline-block;background:white;color:#667eea;text-decoration:none;padding:14px 30px;border-radius:10px;font-weight:600;margin:0 5px;border:2px solid #667eea;">
⚙️ Setup Profile
</a>
</div>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">
<p style="color:#6b7280;font-size:13px;line-height:20px;text-align:center;">
Need help? Contact our support team at <a href="mailto:support@businessmanager.com" style="color:#667eea;">support@businessmanager.com</a>
</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:25px;text-align:center;">
<div style="margin-bottom:15px;">
<a href="#" style="color:#6b7280;text-decoration:none;margin:0 10px;font-size:13px;">Help Center</a>
<span style="color:#d1d5db;">•</span>
<a href="#" style="color:#6b7280;text-decoration:none;margin:0 10px;font-size:13px;">Privacy Policy</a>
<span style="color:#d1d5db;">•</span>
<a href="#" style="color:#6b7280;text-decoration:none;margin:0 10px;font-size:13px;">Terms of Service</a>
</div>
<p style="color:#9ca3af;font-size:12px;margin:0;">
© ${currentYear} Business Manager. All rights reserved.<br>
Empowering businesses worldwide
</p>
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
<p>Thank you for choosing Business Manager. Please use the verification code below to complete your registration. This code is valid for <strong>5 minutes</strong>.</p>
<div style="background:#f3f4f6;border-radius:12px;padding:30px;text-align:center;">
<div style="background:#fff;border-radius:8px;padding:15px;display:inline-block;">
<p style="font-size:48px;font-weight:800;color:#667eea;margin:0;letter-spacing:8px;">${otp}</p>
</div>
</div>
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;margin-top:20px;">
<p style="color:#92400e;margin:0;"><strong>⚠️ Important:</strong> Do not share this code with anyone.</p>
</div>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px;text-align:center;">
<p style="color:#9ca3af;font-size:12px;">© 2024 Business Manager. All rights reserved.</p>
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
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;margin-top:20px;">
<p style="color:#92400e;margin:0;">If you didn't request this, please ignore this email.</p>
</div>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px;text-align:center;">
<p style="color:#9ca3af;font-size:12px;">© 2024 Business Manager. All rights reserved.</p>
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
<h1 style="color:#fff;font-size:28px;margin:20px 0 0 0;">✅ Password Changed!</h1>
<p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;">Your password has been successfully updated</p>
</td></tr>
<tr><td style="padding:40px 30px;">
<p>Hello <strong>${name}</strong>,</p>
<p>Your Business Manager account password was successfully changed on <strong>${new Date().toLocaleString()}</strong>.</p>
<div style="background:#dbeafe;border-radius:12px;padding:20px;margin:25px 0;">
<p style="color:#1e40af;margin:0;">If you made this change, no further action is needed.</p>
</div>
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;margin-top:20px;">
<p style="color:#92400e;margin:0;"><strong>⚠️ Didn't make this change?</strong> Contact support immediately.</p>
</div>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px;text-align:center;">
<p style="color:#9ca3af;font-size:12px;">© 2024 Business Manager. All rights reserved.</p>
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
<h1 style="color:#fff;font-size:24px;margin:20px 0 0 0;">🚨 Multiple Failed Attempts</h1>
<p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;">Your account has been temporarily locked</p>
</td></tr>
<tr><td style="padding:40px 30px;">
<p>Hello <strong>${email.split('@')[0]}</strong>,</p>
<div style="background:#fee2e2;border-radius:12px;padding:20px;margin-bottom:25px;border:1px solid #fecaca;">
<p style="color:#991b1b;margin:0;"><strong>⚠️ Critical Security Alert</strong><br>Your account has been temporarily locked due to ${attemptCount} failed login attempts within a short period.</p>
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
</td></tr>
<tr><td style="background:#f9fafb;padding:20px;text-align:center;">
<p style="color:#9ca3af;font-size:12px;">© 2024 Business Manager. All rights reserved.</p>
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