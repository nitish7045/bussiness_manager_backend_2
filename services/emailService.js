// backend/services/emailService.js
const nodemailer = require("nodemailer");

console.log("📧 Initializing email service...");
console.log("EMAIL_USER:", process.env.EMAIL_USER ? "✅ Set" : "❌ Missing");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "✅ Set" : "❌ Missing");

// Use port 587 with TLS instead of 465 with SSL
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // false for port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  family: 4, // Force IPv4
  requireTLS: true, // Require TLS
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  // Add these to handle Render's network
  tls: {
    rejectUnauthorized: false
  }
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Transporter verification failed:", error.message);
    console.error("Full error:", error);
  } else {
    console.log("✅ Transporter ready to send emails");
  }
});

const sendEmail = async (to, subject, html, from = null) => {
  console.log(`📧 Attempting to send email to: ${to}`);
  console.log(`📧 Subject: ${subject}`);
  
  try {
    const mailOptions = {
      from: from || `"Business Manager" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };
    
    console.log("📧 Mail options prepared");
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email sent successfully to ${to}`);
    console.log(`✅ Message ID: ${info.messageId}`);
    console.log(`✅ Response: ${info.response}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}`);
    console.error(`❌ Error code: ${error.code}`);
    console.error(`❌ Error message: ${error.message}`);
    console.error(`❌ Full error:`, error);
    
    // Log specific SMTP errors
    if (error.code === 'ESOCKET') {
      console.error("❌ Socket error - Network issue or blocked port");
    }
    if (error.code === 'EAUTH') {
      console.error("❌ Authentication failed - Check email/password");
    }
    if (error.code === 'ECONNECTION') {
      console.error("❌ Connection error - Server unreachable");
    }
    if (error.code === 'ETIMEDOUT') {
      console.error("❌ Timeout - Connection took too long");
    }
    
    return false;
  }
};

module.exports = { sendEmail };