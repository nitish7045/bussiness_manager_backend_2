// backend/services/emailService.js
const nodemailer = require("nodemailer");

console.log("📧 Initializing email service...");
console.log("EMAIL_USER:", process.env.EMAIL_USER ? "✅ Set" : "❌ Missing");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "✅ Set" : "❌ Missing");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  family: 4, // Force IPv4
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
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
    
    return false;
  }
};

module.exports = { sendEmail };