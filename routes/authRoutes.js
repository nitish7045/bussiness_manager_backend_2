// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");
const multer = require("multer");

// Use the same secret key as in your middleware
const JWT_SECRET = "secretkey";
const otpStore = {};

// Track login attempts (in production, use Redis or database)
const loginAttempts = new Map(); // email -> {count, lockUntil, lastAttempt, attempts}

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Cache for location data
const locationCache = new Map();

async function getLocationFromIP(req) {
  try {
    // Get the real IP address from request
    let ip = req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip;

    // Clean the IP address
    if (ip && ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    if (ip && ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    // Check cache first (5 minutes cache)
    if (locationCache.has(ip)) {
      const cached = locationCache.get(ip);
      if (Date.now() - cached.timestamp < 300000) {
        return cached.data;
      } else {
        locationCache.delete(ip);
      }
    }

    // Check if it's a local/development IP
    const isLocalIP = ip === '::1' ||
      ip === '127.0.0.1' ||
      ip === 'localhost' ||
      ip === '0:0:0:0:0:0:0:1' ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31);

    let finalIp = ip;

    // If it's a local IP (development), get the public IP
    if (isLocalIP) {
      try {
        const publicIpResponse = await fetch('https://api.ipify.org?format=json');
        const publicIpData = await publicIpResponse.json();
        finalIp = publicIpData.ip;
      } catch (err) {
        console.error("Failed to get public IP:", err);
        return {
          city: 'Development',
          country: 'Local',
          region: 'Development',
          isp: 'Localhost'
        };
      }
    }

    // Get location for the IP
    const response = await fetch(`http://ip-api.com/json/${finalIp}?fields=status,country,city,regionName,isp,lat,lon,query`);
    const data = await response.json();

    let result;

    if (data.status === "success") {
      result = {
        city: data.city || 'Unknown',
        region: data.regionName || 'Unknown',
        country: data.country || 'Unknown',
        isp: data.isp || 'Unknown',
        lat: data.lat,
        lon: data.lon,
        ip: data.query
      };
    } else {
      result = {
        city: 'Unknown',
        region: 'Unknown',
        country: 'Unknown',
        isp: 'Unknown',
        ip: finalIp
      };
    }

    // Cache the result
    locationCache.set(ip, {
      data: result,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    console.error("Error fetching location:", error);
    return {
      city: 'Unknown',
      country: 'Unknown',
      region: 'Unknown',
      isp: 'Unknown'
    };
  }
}

// Helper function to get device info from user-agent
function getDeviceInfo(userAgent) {
  const deviceInfo = {
    browser: "Unknown",
    os: "Unknown",
    device: "Desktop",
  };

  if (!userAgent) return deviceInfo;

  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) deviceInfo.browser = "Chrome";
  else if (userAgent.includes("Firefox")) deviceInfo.browser = "Firefox";
  else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) deviceInfo.browser = "Safari";
  else if (userAgent.includes("Edg")) deviceInfo.browser = "Edge";
  else if (userAgent.includes("Opera")) deviceInfo.browser = "Opera";

  if (userAgent.includes("Windows")) deviceInfo.os = "Windows";
  else if (userAgent.includes("Mac")) deviceInfo.os = "macOS";
  else if (userAgent.includes("Linux")) deviceInfo.os = "Linux";
  else if (userAgent.includes("Android")) deviceInfo.os = "Android";
  else if (userAgent.includes("iOS") || userAgent.includes("iPhone") || userAgent.includes("iPad")) deviceInfo.os = "iOS";

  if (userAgent.includes("Mobile")) deviceInfo.device = "Mobile";
  else if (userAgent.includes("Tablet") || userAgent.includes("iPad")) deviceInfo.device = "Tablet";
  else deviceInfo.device = "Desktop";

  return deviceInfo;
}

// Helper function to update login attempts
function updateLoginAttempts(email, isSuccess) {
  const now = Date.now();
  let data = loginAttempts.get(email);

  if (isSuccess) {
    loginAttempts.delete(email);
    return { count: 0, lockUntil: null };
  }

  if (!data || (data.lockUntil && now > data.lockUntil)) {
    data = { count: 1, lockUntil: null, lastAttempt: now, attempts: [now] };
  } else {
    data.count += 1;
    data.lastAttempt = now;
    data.attempts = data.attempts || [];
    data.attempts.push(now);
    if (data.attempts.length > 10) data.attempts = data.attempts.slice(-10);

    if (data.count >= 5 && !data.lockUntil) {
      data.lockUntil = now + 15 * 60 * 1000;
    }
  }

  loginAttempts.set(email, data);
  return { count: data.count, lockUntil: data.lockUntil };
}

// Check if this is a new location/device - MOVED HERE BEFORE LOGIN ROUTE
function isNewLocation(user, req) {
  if (!user.loginHistory || user.loginHistory.length === 0) {
    return true;
  }

  const ip = req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip;

  const userAgent = req.headers['user-agent'];

  const recentLogins = user.loginHistory.slice(-5);
  return !recentLogins.some(login =>
    login.ip === ip || login.userAgent === userAgent
  );
}

// Email: Wrong Password Alert
async function sendWrongPasswordAlert(email, attemptCount, req) {
  const location = await getLocationFromIP(req);
  const userAgent = req.headers['user-agent'];
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip;
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
  const device = getDeviceInfo(userAgent);
  const time = new Date().toLocaleString();

  const emailHTML = `<!DOCTYPE html>
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

  try {
    await transporter.sendMail({
      from: `"Business Manager Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "⚠️ Security Alert: Failed Login Attempt",
      html: emailHTML,
    });
    console.log(`✅ Wrong password alert sent to ${email}`);
  } catch (error) {
    console.error("Failed to send wrong password alert:", error);
  }
}

// Email: Successful Login Notification
async function sendLoginNotification(email, req, isNewLocation = false) {
  const location = await getLocationFromIP(req);
  const userAgent = req.headers['user-agent'];
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip;
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
  const device = getDeviceInfo(userAgent);
  const time = new Date().toLocaleString();

  const emailHTML = `<!DOCTYPE html>
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

  try {
    await transporter.sendMail({
      from: `"Business Manager Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: isNewLocation ? "🔐 New Login to Your Account" : "✅ Login Notification",
      html: emailHTML,
    });
    console.log(`✅ Login notification sent to ${email}`);
  } catch (error) {
    console.error("Failed to send login notification:", error);
  }
}

// Email: Excessive Failed Attempts Alert
async function sendExcessiveAttemptsAlert(email, attemptCount, req) {
  const location = await getLocationFromIP(req);
  const userAgent = req.headers['user-agent'];
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip;
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);

  const emailHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Security Alert: Multiple Failed Attempts</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg, #dc2626 0%, #991b1b 100%);padding:40px 30px;text-align:center;">
<h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:20px 0 0 0;">🚨 Multiple Failed Attempts</h1>
<p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;">Your account has been temporarily locked</p>
</td></tr>
<tr><td style="padding:40px 30px;">
<p style="color:#1f2937;font-size:16px;margin-bottom:20px;">Hello <strong>${email.split('@')[0]}</strong>,</p>
<div style="background:#fee2e2;border-radius:12px;padding:20px;margin-bottom:25px;border:1px solid #fecaca;">
<p style="color:#991b1b;font-size:15px;margin:0;"><strong>⚠️ Critical Security Alert</strong><br>Your account has been temporarily locked due to ${attemptCount} failed login attempts within a short period.</p>
</div>
<p style="color:#4b5563;font-size:15px;line-height:24px;margin-bottom:20px;">This could indicate someone is trying to access your account without authorization.</p>
<div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:25px;">
<h3 style="color:#374151;font-size:16px;margin:0 0 15px 0;">Attempt Details:</h3>
<table width="100%" style="font-size:14px;">
<tr><td style="padding:8px 0;color:#6b7280;">Total Attempts:</td><td style="padding:8px 0;color:#dc2626;font-weight:700;">${attemptCount}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">IP Address:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${ip}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">Location:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${location.city}, ${location.country}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">ISP:</td><td style="padding:8px 0;color:#1f2937;font-weight:500;">${location.isp || 'Unknown'}</td></tr>
</table>
</div>
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;margin-bottom:25px;border-radius:8px;">
<p style="color:#92400e;font-size:13px;margin:0;"><strong>🔒 Recommended Actions:</strong><br>1. Change your password immediately<br>2. Review recent account activity<br>3. Contact support if you didn't attempt these logins</p>
</div>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px;text-align:center;">
<p style="color:#9ca3af;font-size:12px;margin:0;">© 2024 Business Manager. All rights reserved.<br>This is an automated security alert.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"Business Manager Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🚨 Security Alert: Multiple Failed Login Attempts",
      html: emailHTML,
    });
    console.log(`✅ Excessive attempts alert sent to ${email}`);
  } catch (error) {
    console.error("Failed to send excessive attempts alert:", error);
  }
}

// ==================== ROUTES ====================

// SEND OTP
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    otpStore[email] = otp;

    const emailHTML = `<!DOCTYPE html>
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

    await transporter.sendMail({
      from: `"Business Manager" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Email Verification Code - Business Manager",
      html: emailHTML,
    });

    res.json({ success: true, msg: "OTP sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to send OTP" });
  }
});

// VERIFY OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (otpStore[email] !== otp) {
      return res.status(400).json({ success: false, msg: "Invalid OTP" });
    }
    delete otpStore[email];
    res.json({ success: true, msg: "OTP verified successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "OTP verification failed" });
  }
});

// Welcome Email Function - Add this after your other email functions
async function sendWelcomeEmail(name, email) {
  const currentYear = new Date().getFullYear();
  
  const emailHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Business Manager</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr>
<td align="center">
<table width="100%" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:20px;box-shadow:0 20px 35px -10px rgba(0,0,0,0.1);overflow:hidden;">
  
  <!-- Header with Confetti Animation Effect -->
  <tr>
    <td style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);padding:50px 30px 40px;text-align:center;">
      
      <h1 style="color:#ffffff;font-size:32px;font-weight:700;margin:0 0 10px;">Welcome Aboard! 🎉</h1>
      <p style="color:rgba(255,255,255,0.95);font-size:18px;margin:0;">Your journey with Business Manager begins now</p>
    </td>
  </tr>
  
  <!-- Content Section -->
  <tr>
    <td style="padding:40px 35px;">
      <h2 style="color:#1f2937;font-size:24px;margin:0 0 10px;">Congratulations, ${name.split(' ')[0]}! 🎊</h2>
      <p style="color:#4b5563;font-size:16px;line-height:26px;margin-bottom:25px;">
        Thank you for choosing <strong style="color:#667eea;">Business Manager</strong>. Your account has been successfully created and you're now ready to streamline your workforce management.
      </p>
      
      <!-- Key Features Section -->
      <div style="background:linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%);border-radius:16px;padding:25px;margin-bottom:25px;border:1px solid #e5e7eb;">
        <h3 style="color:#374151;font-size:18px;margin:0 0 15px;">✨ What you can do now:</h3>
        <table width="100%" style="font-size:15px;">
          <tr>
            <td style="padding:8px 0;">
              <span style="color:#10b981;font-weight:bold;">✓</span> Manage your company profile
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;">
              <span style="color:#10b981;font-weight:bold;">✓</span> Track employee attendance
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;">
              <span style="color:#10b981;font-weight:bold;">✓</span> Generate invoices and billing
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;">
              <span style="color:#10b981;font-weight:bold;">✓</span> Access real-time analytics
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;">
              <span style="color:#10b981;font-weight:bold;">✓</span> 24/7 customer support
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Account Details Box -->
      <div style="background:#fef3c7;border-radius:12px;padding:20px;margin-bottom:25px;border-left:4px solid #f59e0b;">
        <h4 style="color:#92400e;font-size:14px;margin:0 0 10px;">📋 Account Details:</h4>
        <table width="100%" style="font-size:14px;">
          <tr>
            <td style="padding:5px 0;color:#6b7280;">Name:</td>
            <td style="padding:5px 0;color:#1f2937;font-weight:500;">${name}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#6b7280;">Email:</td>
            <td style="padding:5px 0;color:#1f2937;font-weight:500;">${email}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#6b7280;">Registered on:</td>
            <td style="padding:5px 0;color:#1f2937;font-weight:500;">${new Date().toLocaleDateString()}</td>
          </tr>
        </table>
      </div>
      
      <!-- Quick Tips -->
      <div style="background:#dbeafe;border-radius:12px;padding:20px;margin-bottom:25px;">
        <h4 style="color:#1e40af;font-size:14px;margin:0 0 10px;">💡 Quick Tips to Get Started:</h4>
        <ul style="color:#1e3a8a;font-size:13px;line-height:20px;margin:0;padding-left:20px;">
          <li>Complete your company profile in Settings</li>
          <li>Add your team members and assign roles</li>
          <li>Set up your GST and tax details for invoicing</li>
          <li>Explore the dashboard to see key metrics</li>
        </ul>
      </div>
      
      <!-- Action Buttons -->
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
    </td>
  </tr>
  
  <!-- Footer -->
  <tr>
    <td style="background-color:#f9fafb;padding:25px;text-align:center;">
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
    </td>
  </tr>
  
</table>
</td>
</tr>
</table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"Business Manager Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🎉 Welcome to Business Manager! Let's Get Started",
      html: emailHTML,
    });
    console.log(`✅ Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return false;
  }
}

// UPDATED REGISTER ROUTE with Welcome Email
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      companyId: `COMP${Date.now()}${Math.floor(Math.random() * 10000)}`,
      companyDetails: { 
        name: "", 
        phone: "", 
        email: email, 
        address: "", 
        gst: "", 
        logo: null 
      },
      loginHistory: [],
      createdAt: new Date(),
      isActive: true,
      isEmailVerified: true // Since OTP is verified before registration
    });
    
    await user.save();

    // Send Welcome Email
    await sendWelcomeEmail(name, email);

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, companyId: user.companyId }, 
      JWT_SECRET, 
      { expiresIn: "7d" }
    );
    
    res.json({ 
      success: true,
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        companyId: user.companyId 
      },
      msg: "Registration successful! Welcome aboard!"
    });
    
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ 
      msg: "Server error", 
      error: err.message 
    });
  }
});
// LOGIN route - DEBUG VERSION
router.post("/login", async (req, res) => {

  try {

    console.log("========== LOGIN START ==========");

    const { email, password } = req.body;

    console.log("📧 Email:", email);

    // ================= ACCOUNT LOCK CHECK =================
    console.log("🔍 Checking account lock...");

    const attemptData = loginAttempts.get(email);

    console.log("Attempt Data:", attemptData);

    if (
      attemptData &&
      attemptData.lockUntil &&
      attemptData.lockUntil > Date.now()
    ) {

      console.log("❌ Account Locked");

      const minutesLeft = Math.ceil(
        (attemptData.lockUntil - Date.now()) / 60000
      );

      return res.status(403).json({
        msg: `Account locked. Try again after ${minutesLeft} minutes.`,
      });

    }

    console.log("✅ Account not locked");

    // ================= FIND USER =================
    console.log("🔍 Finding user in database...");

    const user = await User.findOne({ email });

    console.log("✅ User query completed");

    if (!user) {

      console.log("❌ User not found");

      const newAttempts = updateLoginAttempts(email, false);

      console.log("Updated Attempts:", newAttempts);

      await sendWrongPasswordAlert(
        email,
        newAttempts.count,
        req
      );

      console.log("📧 Wrong password email sent");

      return res.status(400).json({
        msg: "Invalid email or password",
      });

    }

    console.log("✅ User Found");

    // ================= PASSWORD CHECK =================
    console.log("🔍 Comparing password...");

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    console.log("✅ Password compare completed");

    if (!isMatch) {

      console.log("❌ Password Incorrect");

      const newAttempts = updateLoginAttempts(email, false);

      console.log("Updated Attempts:", newAttempts);

      const remainingAttempts =
        5 - newAttempts.count;

      await sendWrongPasswordAlert(
        email,
        newAttempts.count,
        req
      );

      console.log("📧 Wrong password alert sent");

      if (newAttempts.count >= 5) {

        console.log("❌ Too many attempts");

        await sendExcessiveAttemptsAlert(
          email,
          newAttempts.count,
          req
        );

        console.log("📧 Excessive attempt email sent");

        return res.status(403).json({
          msg:
            "Too many failed attempts. Account locked for 15 minutes.",
        });

      }

      return res.status(400).json({
        msg: `Invalid password. ${remainingAttempts} attempts remaining.`,
      });

    }

    console.log("✅ Password Correct");

    // ================= RESET LOGIN ATTEMPTS =================
    console.log("🔄 Resetting login attempts...");

    updateLoginAttempts(email, true);

    console.log("✅ Login attempts reset");

    // ================= LOCATION CHECK =================
    console.log("🌍 Checking location...");

    const newLocationDetected =
      isNewLocation(user, req);

    console.log(
      "New Location Detected:",
      newLocationDetected
    );

    // ================= SEND LOGIN EMAIL =================
    console.log("📧 Sending login notification email...");

    await sendLoginNotification(
      email,
      req,
      newLocationDetected
    );

    console.log("✅ Login notification email sent");

    // ================= GET IP =================
    console.log("🌐 Getting IP...");

    let ip =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip;

    if (ip && ip.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }

    console.log("IP Address:", ip);

    // ================= GET LOCATION =================
    console.log("🌍 Getting location from IP...");

    const location = await getLocationFromIP(req);

    console.log("Location:", location);

    // ================= SAVE LOGIN HISTORY =================
    console.log("💾 Saving login history...");

    user.lastLogin = new Date();

    user.loginHistory =
      user.loginHistory || [];

    user.loginHistory.unshift({
      timestamp: new Date(),
      ip: ip,
      userAgent: req.headers["user-agent"],
      location: `${location.city}, ${location.country}`,
    });

    if (user.loginHistory.length > 50) {

      user.loginHistory =
        user.loginHistory.slice(0, 50);

    }

    await user.save();

    console.log("✅ User history saved");

    // ================= GENERATE TOKEN =================
    console.log("🔑 Generating JWT token...");

    const token = jwt.sign(
      {
        id: user._id,
        companyId: user.companyId,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    console.log("✅ Token Generated");

    // ================= SEND RESPONSE =================
    console.log("🚀 Sending success response...");

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        companyId: user.companyId,
      },
      msg: "Login successful",
    });

    console.log("========== LOGIN SUCCESS ==========");

  } catch (err) {

    console.log("========== LOGIN ERROR ==========");

    console.error("❌ Full Error:", err);

    console.error("❌ Error Message:", err.message);

    console.error("❌ Stack:", err.stack);

    res.status(500).json({
      msg: "Server error",
      error: err.message,
    });

  }

});
// Get current user
router.get("/me", async (req, res) => {
  try {
    let token = req.header("Authorization");
    if (!token) return res.status(401).json({ msg: "No token provided" });
    if (token.startsWith("Bearer ")) token = token.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(401).json({ msg: "Invalid token" });
  }
});

// Get login history
router.get("/login-history", async (req, res) => {
  try {
    let token = req.header("Authorization");
    if (!token) return res.status(401).json({ msg: "No token provided" });
    if (token.startsWith("Bearer ")) token = token.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("loginHistory");
    res.json({ loginHistory: user.loginHistory || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching login history" });
  }
});

// Update company details
router.put("/company-details", async (req, res) => {
  try {
    let token = req.header("Authorization");
    if (!token) return res.status(401).json({ msg: "No token provided" });
    if (token.startsWith("Bearer ")) token = token.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const { companyDetails } = req.body;
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.companyDetails = { ...user.companyDetails, ...companyDetails };
    await user.save();
    res.json({ msg: "Company details updated successfully", companyDetails: user.companyDetails });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error updating company details" });
  }
});

// Get company details
router.get("/company-details", async (req, res) => {
  try {
    let token = req.header("Authorization");
    if (!token) return res.status(401).json({ msg: "No token provided" });
    if (token.startsWith("Bearer ")) token = token.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("companyDetails name email");
    res.json({ companyDetails: user.companyDetails || {}, userName: user.name, userEmail: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching company details" });
  }
});

// Configure multer for logo upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  }
});

router.post("/upload-logo", upload.single("logo"), async (req, res) => {
  try {
    let token = req.header("Authorization");
    if (!token) return res.status(401).json({ msg: "No token provided" });
    if (token.startsWith("Bearer ")) token = token.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });
    const base64Logo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.companyDetails.logo = base64Logo;
    await user.save();
    res.json({ msg: "Logo uploaded successfully", logo: user.companyDetails.logo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error uploading logo" });
  }
});

// Delete company logo
router.delete("/delete-logo", async (req, res) => {
  try {
    let token = req.header("Authorization");
    if (!token) return res.status(401).json({ msg: "No token provided" });
    if (token.startsWith("Bearer ")) token = token.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.companyDetails.logo = null;
    await user.save();
    res.json({ msg: "Logo deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error deleting logo" });
  }
});

// Add these routes to your authRoutes.js

// Forgot Password - Send OTP
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: "No account found with this email address" });
    }
    
    // Generate OTP
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });
    
    // Store OTP with expiry (15 minutes)
    const otpKey = `reset_${email}`;
    otpStore[otpKey] = {
      otp: otp,
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes
    };
    
    // Send OTP email
    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Password Reset OTP</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
          <tr><td align="center">
            <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
              <tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 30px;text-align:center;">
                <h1 style="color:#fff;font-size:28px;margin:0;">🔐 Password Reset</h1>
              </td></tr>
              <tr><td style="padding:40px 30px;">
                <p>Hello <strong>${user.name}</strong>,</p>
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
      </html>
    `;
    
    await transporter.sendMail({
      from: `"Business Manager Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Password Reset OTP - Business Manager",
      html: emailHTML,
    });
    
    res.json({ 
      success: true, 
      msg: "OTP sent to your email address" 
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to send OTP" });
  }
});

// Verify Reset OTP
router.post("/verify-reset-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const otpKey = `reset_${email}`;
    const storedData = otpStore[otpKey];
    
    if (!storedData) {
      return res.status(400).json({ msg: "No OTP found. Please request a new one." });
    }
    
    if (Date.now() > storedData.expiresAt) {
      delete otpStore[otpKey];
      return res.status(400).json({ msg: "OTP has expired. Please request a new one." });
    }
    
    if (storedData.otp !== otp) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }
    
    // Generate a temporary reset token
    const resetToken = jwt.sign(
      { email: email, purpose: "password_reset" },
      JWT_SECRET,
      { expiresIn: "10m" }
    );
    
    // Clear OTP after successful verification
    delete otpStore[otpKey];
    
    res.json({ 
      success: true, 
      token: resetToken,
      msg: "OTP verified successfully" 
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "OTP verification failed" });
  }
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.email !== email || decoded.purpose !== "password_reset") {
      return res.status(400).json({ msg: "Invalid reset token" });
    }
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.lastPasswordChange = new Date();
    await user.save();
    
    // Send confirmation email
    const confirmationHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Password Changed Successfully</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
          <tr><td align="center">
            <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
              <tr><td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:40px 30px;text-align:center;">
                <h1 style="color:#fff;font-size:28px;margin:20px 0 0 0;">✅ Password Changed!</h1>
                <p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;">Your password has been successfully updated</p>
              </td></tr>
              <tr><td style="padding:40px 30px;">
                <p>Hello <strong>${user.name}</strong>,</p>
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
      </html>
    `;
    
    await transporter.sendMail({
      from: `"Business Manager Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "✅ Password Changed Successfully - Business Manager",
      html: confirmationHTML,
    });
    
    res.json({ 
      success: true, 
      msg: "Password reset successfully" 
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to reset password" });
  }
});

module.exports = router;