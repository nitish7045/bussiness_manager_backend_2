// backend/services/sendgridService.js
const sgMail = require('@sendgrid/mail');

console.log("📧 Initializing SendGrid...");
console.log("SENDGRID_API_KEY:", process.env.SENDGRID_API_KEY ? "✅ Set" : "❌ Missing");
console.log("FROM_EMAIL:", process.env.FROM_EMAIL ? "✅ Set" : "❌ Missing");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, html, from = null) => {
  console.log(`📧 Attempting to send email to: ${to}`);
  console.log(`📧 Subject: ${subject}`);
  console.log(`📧 Timestamp: ${new Date().toISOString()}`);
  
  try {
    const msg = {
      to: to,
      from: from || process.env.FROM_EMAIL || "team11.officialhub@gmail.com",
      subject: subject,
      html: html,
    };
    
    console.log("📧 Sending via SendGrid...");
    const response = await sgMail.send(msg);
    
    console.log(`✅ Email sent successfully to ${to}`);
    console.log(`✅ Status Code: ${response[0].statusCode}`);
    console.log(`✅ Message ID: ${response[0].headers['x-message-id']}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}`);
    console.error(`❌ Error time: ${new Date().toISOString()}`);
    
    if (error.response) {
      console.error(`❌ SendGrid Error Response:`, JSON.stringify(error.response.body, null, 2));
    } else {
      console.error(`❌ Error message: ${error.message}`);
    }
    
    return false;
  }
};

module.exports = { sendEmail };