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

// ======================================================
// OTP MESSAGE
// ======================================================

async function getOTPWhatsApp(name, otp) {

  return `
🔐 *Business Manager Verification*

Hello ${name},

Your verification code is:

*${otp}*

⏳ Valid for 5 minutes.

Do not share this code with anyone.

- Business Manager
`;

}

// ======================================================
// PASSWORD RESET OTP
// ======================================================

async function getPasswordResetOTPWhatsApp(
  name,
  otp
) {

  return `
🔑 *Password Reset Request*

Hello ${name},

Your password reset OTP is:

*${otp}*

⏳ Valid for 15 minutes.

If you did not request this,
please ignore this message.

- Business Manager
`;

}

// ======================================================
// LOGIN SUCCESS
// ======================================================

async function getLoginNotificationWhatsApp(
  email,
  req
) {

  const location =
    await getLocationFromIP(req);

  const device =
    getDeviceInfo(
      req.headers["user-agent"]
    );

  const time = getISTTime();

  return `
✅ *Login Successful*

Account:
${email}

🕒 Time:
${time} IST

📍 Location:
${formatLocation(location)}

📱 Device:
${device.device}

🌐 Browser:
${device.browser}

If this wasn't you,
please secure your account immediately.

- Business Manager
`;

}

// ======================================================
// WRONG PASSWORD ALERT
// ======================================================

async function getWrongPasswordWhatsApp(
  email,
  attemptCount
) {

  const remainingAttempts =
    5 - attemptCount;

  return `
⚠️ *Failed Login Attempt*

Account:
${email}

❌ Attempt:
${attemptCount}

🔒 Remaining Attempts:
${remainingAttempts}

If this wasn't you,
consider changing your password.

- Business Manager
`;

}

// ======================================================
// PASSWORD CHANGED
// ======================================================

async function getPasswordChangedWhatsApp(
  name
) {

  const time = getISTTime();

  return `
✅ *Password Changed Successfully*

Hello ${name},

Your password was updated successfully.

🕒 Time:
${time} IST

If you did not perform this action,
secure your account immediately.

- Business Manager
`;

}

// ======================================================
// WELCOME MESSAGE
// ======================================================

async function getWelcomeWhatsApp(
  name
) {

  return `
🎉 *Welcome to Business Manager*

Hello ${name},

Your account has been created successfully.

You can now access:
✅ Attendance Management
✅ Billing System
✅ Employee Management
✅ Salary Management

Welcome aboard 🚀

- Business Manager
`;

}

// ======================================================
// EXCESSIVE ATTEMPTS
// ======================================================

async function getExcessiveAttemptsWhatsApp(
  email,
  attemptCount
) {

  return `
🚨 *Account Security Alert*

Account:
${email}

❌ Failed Attempts:
${attemptCount}

🔒 Your account has been temporarily locked
for security protection.

Please try again after 15 minutes.

If this wasn't you,
reset your password immediately.

- Business Manager
`;

}

// ======================================================
// SALARY GENERATED
// ======================================================

async function getSalaryGeneratedWhatsApp(
  employeeName,
  month,
  amount
) {

  return `
💰 *Salary Generated*

Hello ${employeeName},

Your salary for *${month}* has been generated successfully.

💵 Amount:
₹${amount}

📄 Salary slip attached.

- Business Manager
`;

}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  getOTPWhatsApp,

  getPasswordResetOTPWhatsApp,

  getLoginNotificationWhatsApp,

  getWrongPasswordWhatsApp,

  getPasswordChangedWhatsApp,

  getWelcomeWhatsApp,

  getExcessiveAttemptsWhatsApp,

  getSalaryGeneratedWhatsApp,

};