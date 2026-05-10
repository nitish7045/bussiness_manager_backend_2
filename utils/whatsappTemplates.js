// backend/utils/whatsappTemplates.js

const { getDeviceInfo } = require("../services/deviceService");
const { getLocationFromIP } = require("../services/locationService");

// ======================================================
// COMMON HELPERS
// ======================================================

function getISTTime() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatLocation(location) {
  const parts = [];

  if (location.city && location.city !== "Unknown") {
    parts.push(location.city);
  }

  if (location.region && location.region !== "Unknown") {
    parts.push(location.region);
  }

  if (location.country && location.country !== "Unknown") {
    parts.push(location.country);
  }

  if (parts.length === 0) {
    return "Unknown Location";
  }

  return parts.join(", ");
}

// Get time-based greeting
function getTimeBasedGreeting(name) {
  const hour = new Date().getHours();
  let greeting = "";
  
  if (hour < 12) {
    greeting = "🌅 Good Morning";
  } else if (hour < 17) {
    greeting = "☀️ Good Afternoon";
  } else if (hour < 20) {
    greeting = "🌤️ Good Evening";
  } else {
    greeting = "🌙 Good Night";
  }
  
  return `${greeting}, ${name}!`;
}

// Get random emoji for personalization
function getRandomThankYouEmoji() {
  const emojis = ["🙏", "😊", "👍", "✨", "🌟", "💫", "🎯", "💪"];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

// ======================================================
// OTP MESSAGE (Enhanced)
// ======================================================

async function getOTPWhatsApp(name, otp) {
  const greeting = getTimeBasedGreeting(name);
  
  return `
*🏢 Business Manager (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━

${greeting}

*🔐 Email Verification Required*

Your OTP for verification is:

*┏━━━━━━━━━━━━━━━━━━┓*
*┃   ${otp}   ┃*
*┗━━━━━━━━━━━━━━━━━━┛*

*⏱️ Valid for 5 minutes only*

⚠️ *Security Tips:*
• Never share this OTP with anyone
• We never ask for your password
• This is an automated message

━━━━━━━━━━━━━━━━━━━━━━━
*Need help?* Contact support
*${getRandomThankYouEmoji()}* Thank you for choosing us
━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ======================================================
// PASSWORD RESET OTP (Enhanced)
// ======================================================

async function getPasswordResetOTPWhatsApp(name, otp) {
  const greeting = getTimeBasedGreeting(name);
  
  return `
*🏢 Business Manager (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━

${greeting}

*🔑 Password Reset Request*

We received a request to reset your password.

*Your OTP for password reset:*

*┏━━━━━━━━━━━━━━━━━━┓*
*┃   ${otp}   ┃*
*┗━━━━━━━━━━━━━━━━━━┛*

*⏱️ Valid for 15 minutes only*

⚠️ *Didn't request this?*
• Ignore this message
• Your password will remain unchanged
• Contact support if suspicious

━━━━━━━━━━━━━━━━━━━━━━━
*🔒 Keep your account secure*
${getRandomThankYouEmoji()} *Stay safe!*
━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ======================================================
// LOGIN SUCCESS (Enhanced)
// ======================================================

async function getLoginNotificationWhatsApp(email, req) {
  const location = await getLocationFromIP(req);
  const device = getDeviceInfo(req.headers["user-agent"]);
  const time = getISTTime();
  
  // Extract name from email (before @)
  const name = email.split('@')[0];
  const greeting = getTimeBasedGreeting(name);
  
  return `
*🏢 Business Manager (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━

${greeting}

*✅ New Login Detected*

*📧 Account:* ${email}
*🕒 Time:* ${time} IST

━━━━━━━━━━━━━━━━━━━━━━━
*📍 Login Location Details*
━━━━━━━━━━━━━━━━━━━━━━━

*📍 Location:* ${formatLocation(location)}
*📱 Device:* ${device.device}
*🌐 Browser:* ${device.browser}
*🖥️ OS:* ${device.os || "Unknown"}

━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *If this wasn't you:*
• Change your password immediately
• Enable two-factor authentication
• Contact our support team

✅ *If this was you:*
• You can ignore this message
• Your account is secure

━━━━━━━━━━━━━━━━━━━━━━━
*🔐 Stay vigilant, stay secure!*
━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ======================================================
// WRONG PASSWORD ALERT (Enhanced)
// ======================================================

async function getWrongPasswordWhatsApp(email, attemptCount) {
  const remainingAttempts = 5 - attemptCount;
  const name = email.split('@')[0];
  const greeting = getTimeBasedGreeting(name);
  
  let warningEmoji = "⚠️";
  let urgencyMessage = "";
  
  if (remainingAttempts <= 2) {
    warningEmoji = "🚨";
    urgencyMessage = "\n*⚠️ CRITICAL: Only few attempts left!*";
  }
  
  return `
*🏢 Business Manager (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━

${greeting}

*${warningEmoji} Failed Login Attempt Alert*

*📧 Account:* ${email}
*❌ Attempt Number:* ${attemptCount}/5
*🔒 Remaining Attempts:* ${remainingAttempts}
${urgencyMessage}

━━━━━━━━━━━━━━━━━━━━━━━

*📋 What to do next:*

• 🔐 Use "Forgot Password" if needed
• 💡 Make sure Caps Lock is OFF
• 🔄 Check if password is correct

━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *Security Recommendation:*
If this wasn't you, consider:
• Changing your password immediately
• Reviewing recent account activity

━━━━━━━━━━━━━━━━━━━━━━━
*${getRandomThankYouEmoji()}* *Secure your account*
━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ======================================================
// PASSWORD CHANGED (Enhanced)
// ======================================================

async function getPasswordChangedWhatsApp(name) {
  const time = getISTTime();
  const greeting = getTimeBasedGreeting(name);
  
  return `
*🏢 Business Manager (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━

${greeting}

*✅ Password Updated Successfully*

*🕒 Time of change:* ${time} IST

━━━━━━━━━━━━━━━━━━━━━━━

*📋 Your account security has been enhanced*

*💡 Next steps:*
• Use your new password for future logins
• Don't share your password with anyone
• Enable 2FA for extra security

━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *Didn't make this change?*
• Reset your password immediately
• Contact support right away
• Review your account activity

━━━━━━━━━━━━━━━━━━━━━━━
*🔐 Your security is our priority*
*${getRandomThankYouEmoji()}* *Stay safe!*
━━━━━━━━━━━━━━━━━━━━━━━
`;
}
// ======================================================
// WELCOME MESSAGE (Updated with your actual features)
// ======================================================

async function getWelcomeWhatsApp(name) {
  const greeting = getTimeBasedGreeting(name);
  
  return `
*🎉 WELCOME TO BUSINESS MANAGER (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${greeting}

*✨ Thank you for choosing us!*

Your account has been successfully created.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*🚀 What you can do now:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *Dashboard*
   • Quick track employee activity
   • Active/Deactive workers summary
   • Today's attendance overview
   • Last session insights

👥 *Worker Management*
   • Add/Manage worker details
   • Store Name, Phone, Bank, UPI ID
   • Upload worker photo
   • Save Aadhar Card photos
   • Active/Deactive workers

✅ *Attendance Management*
   • Mark daily attendance
   • Track worker attendance
   • View attendance history

💰 *Advance Management*
   • Track employee advances
   • Complete advance history
   • Manage loan details
   • Advance payment tracking

📊 *Salary Management*
   • Process monthly payroll
   • Generate salary slips
   • Track salary history
   • Manage deductions

📋 *Reports*
   • Salary Report
   • Advance & Loan Report
   • Attendance Report
   • Worker Report

⚙️ *Company Settings*
   • Configure business profile
   • Manage WhatsApp notifications
   • Update GST, Address, Logo

🧪 *Billing App*
   • Currently in Beta Testing
   • Coming soon with full features

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📱 Quick Setup Guide:*

1️⃣ *Complete Company Profile*
   • Add your business logo
   • Update GST number
   • Set billing phone number
   • Configure WhatsApp number

2️⃣ *Add Your Workers*
   • Upload worker details
   • Save UPI & Bank info
   • Store documents securely

3️⃣ *Start Tracking*
   • Mark daily attendance
   • Manage advances
   • Process salaries

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*🔔 WhatsApp Notifications Active*
You'll receive alerts for:
• Worker attendance
• Salary generation
• Advance requests
• Security updates

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Need assistance?* 
📧 support@nitishsoftware.com
📞 +91 XXXXXXXXXX

*💡 Pro Tips:*
• Keep worker documents updated
• Review reports monthly
• Enable all notification features

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*🎯 Streamline your workforce management!*
*${getRandomThankYouEmoji()}* *Happy Managing!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ======================================================
// SALARY GENERATED (Enhanced with your features)
// ======================================================

async function getSalaryGeneratedWhatsApp(employeeName, month, amount) {
  const greeting = getTimeBasedGreeting(employeeName);
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
  
  return `
*🏢 Business Manager (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${greeting}

*💰 Salary Generated Successfully*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📋 Salary Details:*

👤 *Employee:* ${employeeName}
📅 *Month:* ${month}
💵 *Amount:* ${formattedAmount}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📊 What's Next:*

✅ Salary has been processed
📎 Salary slip generated
💳 Can be viewed in Salary Management

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📱 Quick Actions:*

• Download salary slip from Reports
• Check advance/loan deductions
• View attendance for the month
• Review salary report

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*💡 Pro Tip:* 
Track all advances and loans in Advance Management before salary processing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*For any discrepancies, check:*
• Attendance Report
• Advance History
• Company Settings

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*${getRandomThankYouEmoji()}* *Thank you for your hard work!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ======================================================
// NEW: ADVANCE REQUEST NOTIFICATION
// ======================================================

async function getAdvanceRequestWhatsApp(employeeName, amount, reason) {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
  
  return `
*🏢 Business Manager (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*💰 Advance Request Notification*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *Employee:* ${employeeName}
💵 *Amount:* ${formattedAmount}
📝 *Reason:* ${reason}
🕒 *Requested:* ${getISTTime()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📋 Next Steps:*

✅ Review request in Advance Management
✅ Approve or decline request
✅ Track in advance history

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*🔔 This is an automated notification*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Manage all advances in Advance Management section*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ======================================================
// NEW: DAILY ATTENDANCE SUMMARY
// ======================================================

async function getDailyAttendanceSummaryWhatsApp(totalWorkers, present, absent, onLeave) {
  const attendanceRate = ((present / totalWorkers) * 100).toFixed(1);
  
  return `
*🏢 Business Manager (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📊 Daily Attendance Summary*

📅 *Date:* ${new Date().toLocaleDateString('en-IN')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 *Total Workers:* ${totalWorkers}
✅ *Present:* ${present}
❌ *Absent:* ${absent}
🏖️ *On Leave:* ${onLeave}
📈 *Attendance Rate:* ${attendanceRate}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📱 Quick Actions:*

• View detailed report in Reports section
• Check individual worker attendance
• Generate monthly attendance report

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*🔔 Daily summary from Attendance Management*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Track attendance regularly for accurate payroll*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ======================================================
// NEW: ADVANCE REPAYMENT REMINDER
// ======================================================

async function getAdvanceRepaymentReminderWhatsApp(employeeName, pendingAmount, dueDate) {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(pendingAmount);
  
  return `
*🏢 Business Manager (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*💰 Advance Repayment Reminder*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *Employee:* ${employeeName}
💵 *Pending Amount:* ${formattedAmount}
📅 *Due Date:* ${dueDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📋 Action Required:*

• Check Advance Management
• Track repayment history
• Update payment status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*⚠️ Regular tracking helps maintain accurate records*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*View complete history in Reports section*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}


// ======================================================
// EXCESSIVE ATTEMPTS (Enhanced)
// ======================================================

async function getExcessiveAttemptsWhatsApp(email, attemptCount) {
  const name = email.split('@')[0];
  const greeting = getTimeBasedGreeting(name);
  
  return `
*🏢 Business Manager (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━

${greeting}

*🚨 SECURITY ALERT - ACCOUNT LOCKED*

*📧 Account:* ${email}
*❌ Failed Attempts:* ${attemptCount}/5
*🔒 Status:* TEMPORARILY LOCKED

━━━━━━━━━━━━━━━━━━━━━━━

*⏱️ Lock Duration:* 15 minutes
*🕒 Lock will expire at:* ${new Date(Date.now() + 15 * 60000).toLocaleTimeString()}

━━━━━━━━━━━━━━━━━━━━━━━

*📋 What you need to do:*

1️⃣ *Wait for 15 minutes*
   • Don't try again until lock expires

2️⃣ *Reset your password*
   • Use "Forgot Password" feature
   • Create a strong password

3️⃣ *Review account security*
   • Check for unauthorized access
   • Update security questions

━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *Security Tips:*
• Use a strong, unique password
• Never share login credentials
• Enable 2-factor authentication
• Be aware of phishing attempts

━━━━━━━━━━━━━━━━━━━━━━━

*After lock expires, you'll have 5 new attempts*

━━━━━━━━━━━━━━━━━━━━━━━
*🔐 For immediate assistance, contact support*
*${getRandomThankYouEmoji()}* *Stay secure!*
━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ======================================================
// SALARY GENERATED (Enhanced)
// ======================================================

async function getSalaryGeneratedWhatsApp(employeeName, month, amount) {
  const greeting = getTimeBasedGreeting(employeeName);
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
  
  return `
*🏢 Business Manager (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${greeting}

*💰 Salary Generated Successfully*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📋 Salary Details:*

👤 *Employee:* ${employeeName}
📅 *Month:* ${month}
💵 *Amount:* ${formattedAmount}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📄 What's Next:*

✅ Salary has been processed
📎 Salary slip is attached
💳 Amount will be credited as per company policy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📊 Quick Actions:*
• Download your salary slip
• Check tax deductions (if any)
• Review leave balance
• Plan your finances

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*💡 Pro Tip:* Save your salary slips for future reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*For any discrepancies, contact HR immediately*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*${getRandomThankYouEmoji()}* *Thank you for your hard work!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ======================================================
// EXPORTS
// ======================================================

// Update exports
module.exports = {
  getOTPWhatsApp,
  getPasswordResetOTPWhatsApp,
  getLoginNotificationWhatsApp,
  getWrongPasswordWhatsApp,
  getPasswordChangedWhatsApp,
  getWelcomeWhatsApp,
  getExcessiveAttemptsWhatsApp,
  getSalaryGeneratedWhatsApp,
  getAdvanceRequestWhatsApp,           // NEW
  getDailyAttendanceSummaryWhatsApp,   // NEW
  getAdvanceRepaymentReminderWhatsApp, // NEW
};