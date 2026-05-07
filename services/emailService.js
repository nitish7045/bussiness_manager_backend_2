// backend/services/emailService.js

const nodemailer = require("nodemailer");
const dns = require("dns");

// Force IPv4
dns.setDefaultResultOrder("ipv4first");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  tls: {
    rejectUnauthorized: false,
  },

  family: 4,

  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});

// Verify SMTP connection
transporter.verify((error, success) => {
  if (error) {
    console.log("❌ SMTP ERROR:", error);
  } else {
    console.log("✅ SMTP SERVER READY");
  }
});

// SEND EMAIL FUNCTION
const sendEmail = async (
  to,
  subject,
  html,
  from = null
) => {
  try {
    const info = await transporter.sendMail({
      from:
        from ||
        `"Business Manager" <${process.env.EMAIL_USER}>`,

      to,
      subject,
      html,
    });

    console.log(
      `✅ Email sent to ${to}`
    );

    console.log("Message ID:", info.messageId);

    return true;
  } catch (error) {
    console.error(
      `❌ Failed to send email to ${to}:`,
      error
    );

    return false;
  }
};

module.exports = { sendEmail };