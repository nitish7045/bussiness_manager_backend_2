// backend/services/emailService.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Force IPv4 and different port
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  family: 4,
});

const sendEmail = async (to, subject, html, from = null) => {
  try {
    await transporter.sendMail({
      from: from || `"Business Manager" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    return false;
  }
};

module.exports = { sendEmail };