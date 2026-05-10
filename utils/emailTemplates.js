// backend/utils/emailTemplates.js

const { getDeviceInfo } = require("../services/deviceService");
const { getLocationFromIP } = require("../services/locationService");

// ======================================================
// COMMON FOOTER
// ======================================================

function getISTTime() {
    const now = new Date();
    // Format: "08/05/2026, 04:53:37 PM"
    return now.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

const getCommonFooter = () => {
    const currentYear = new Date().getFullYear();

    return `
  <div style="
    margin-top:35px;
    padding-top:20px;
    border-top:1px solid #e5e7eb;
    text-align:center;
  ">
    <p style="
      color:#6b7280;
      font-size:12px;
      line-height:20px;
      margin:0;
    ">
      <strong>Business Manager (Nitish Software)</strong><br>
      Mumbai, Maharashtra, India
    </p>

    <p style="
      color:#9ca3af;
      font-size:11px;
      line-height:18px;
      margin-top:12px;
    ">
      This is an automated transactional email related to your account activity.
    </p>

    <p style="
      color:#cbd5e1;
      font-size:10px;
      margin-top:12px;
    ">
      © ${currentYear} Business Manager (Nitish Software)
    </p>
  </div>
  `;
};

// ======================================================
// EMAIL LAYOUT WRAPPER
// ======================================================

const createEmailLayout = ({
    title,
    subtitle,
    headerColor = "#4f46e5",
    body,
}) => {
    return `
<!DOCTYPE html>
<html>

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f3f4f6;
  font-family:Arial,sans-serif;
">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr>
<td align="center">

<table width="100%" cellpadding="0" cellspacing="0"
style="
  max-width:560px;
  background:#ffffff;
  border-radius:14px;
  overflow:hidden;
  border:1px solid #e5e7eb;
">

<tr>
<td style="
  background:${headerColor};
  padding:35px 30px;
  text-align:center;
">

<h1 style="
  color:#ffffff;
  margin:0;
  font-size:28px;
  font-weight:700;
">
${title}
</h1>

<p style="
  color:rgba(255,255,255,0.9);
  margin:10px 0 0 0;
  font-size:14px;
">
${subtitle}
</p>

</td>
</tr>

<tr>
<td style="padding:40px 30px;">
${body}
${getCommonFooter()}
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;
};

// Helper function to format location properly
function formatLocation(location) {
    const parts = [];
    if (location.city && location.city !== "Unknown") parts.push(location.city);
    if (location.region && location.region !== "Unknown") parts.push(location.region);
    if (location.country && location.country !== "Unknown") parts.push(location.country);
    
    if (parts.length === 0) return "Unable to determine";
    
    let locationText = parts.join(", ");
    
    // Add mobile network note if applicable
    if (location.isMobileNetwork) {
        locationText += " (Mobile Network - Location approximate)";
    }
    
    return locationText;
}

// ======================================================
// OTP EMAIL
// ======================================================

async function getOTPEmail(email, otp) {
    return createEmailLayout({
        title: "Email Verification",
        subtitle: "Use the verification code below",
        headerColor: "#4f46e5",

        body: `
      <p style="font-size:16px;color:#111827;">
        Hello <strong>${email.split("@")[0]}</strong>,
      </p>

      <p style="
        color:#4b5563;
        font-size:15px;
        line-height:24px;
      ">
        Use the verification code below to continue.
        This code is valid for 5 minutes.
      </p>

      <div style="
        margin:35px 0;
        text-align:center;
      ">

        <div style="
          display:inline-block;
          background:#f9fafb;
          border:1px solid #d1d5db;
          border-radius:12px;
          padding:18px 35px;
        ">

          <div style="
            font-size:42px;
            letter-spacing:8px;
            font-weight:700;
            color:#4f46e5;
          ">
            ${otp}
          </div>

        </div>

      </div>

      <div style="
        background:#f9fafb;
        border-radius:10px;
        padding:16px;
      ">
        <p style="
          margin:0;
          color:#6b7280;
          font-size:13px;
          line-height:22px;
        ">
          If you did not request this verification code,
          you can safely ignore this email.
        </p>
      </div>
    `,
    });
}

// ======================================================
// PASSWORD RESET OTP
// ======================================================

async function getPasswordResetOTPEmail(email, name, otp) {
    return createEmailLayout({
        title: "Password Reset",
        subtitle: "Verification required",
        headerColor: "#2563eb",

        body: `
      <p style="font-size:16px;color:#111827;">
        Hello <strong>${name}</strong>,
      </p>

      <p style="
        color:#4b5563;
        font-size:15px;
        line-height:24px;
      ">
        We received a request to reset your password.
        Use the verification code below to continue.
      </p>

      <div style="
        margin:35px 0;
        text-align:center;
      ">

        <div style="
          display:inline-block;
          background:#f9fafb;
          border:1px solid #d1d5db;
          border-radius:12px;
          padding:18px 35px;
        ">

          <div style="
            font-size:42px;
            letter-spacing:8px;
            font-weight:700;
            color:#2563eb;
          ">
            ${otp}
          </div>

        </div>

      </div>

      <div style="
        background:#f9fafb;
        border-radius:10px;
        padding:16px;
      ">
        <p style="
          margin:0;
          color:#6b7280;
          font-size:13px;
          line-height:22px;
        ">
          This code expires in 15 minutes.
        </p>
      </div>
    `,
    });
}

// ======================================================
// LOGIN NOTIFICATION
// ======================================================

async function getLoginNotificationEmail(email, req, isNewLocation) {
    const location = await getLocationFromIP(req);
    const device = getDeviceInfo(req.headers["user-agent"]);
    
    let ip = req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.ip;

    if (ip && ip.startsWith("::ffff:")) {
        ip = ip.substring(7);
    }
    
    // Clean IP - remove multiple IPs
    if (ip && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
    }

    const time = getISTTime();
    const locationText = formatLocation(location);
    const networkInfo = location.isp !== "Unknown" ? location.isp : "Unknown";

    return createEmailLayout({
        title: isNewLocation ? "New Login Detected" : "Login Successful",
        subtitle: "Recent account activity",
        headerColor: "#059669",

        body: `
      <p style="font-size:16px;color:#111827;">
        Hello <strong>${email.split("@")[0]}</strong>,
      </p>

      <p style="
        color:#4b5563;
        font-size:15px;
        line-height:24px;
      ">
        Your account was recently accessed successfully.
      </p>

      <div style="
        background:#f9fafb;
        border:1px solid #e5e7eb;
        border-radius:12px;
        padding:20px;
        margin-top:25px;
      ">

        <table width="100%" style="font-size:14px;">

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Time
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${time} IST
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              IP Address
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${ip}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Location
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${locationText}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Network/ISP
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${networkInfo}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Device
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${device.device}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Operating System
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${device.os}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Browser
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${device.browser}
            </td>
          </tr>

        </table>

      </div>

      <div style="
        background:#f0fdf4;
        border-radius:10px;
        padding:16px;
        margin-top:20px;
      ">
        <p style="
          margin:0;
          color:#065f46;
          font-size:13px;
          line-height:22px;
        ">
          If this was you, no further action is needed.
          If you didn't perform this login, please secure your account immediately.
        </p>
      </div>
    `,
    });
}

// ======================================================
// WRONG PASSWORD ALERT
// ======================================================

async function getWrongPasswordEmail(email, attemptCount, req) {
    const location = await getLocationFromIP(req);
    const device = getDeviceInfo(req.headers["user-agent"]);
    
    let ip = req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.ip;

    if (ip && ip.startsWith("::ffff:")) {
        ip = ip.substring(7);
    }
    
    if (ip && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
    }

    const time = getISTTime();
    const locationText = formatLocation(location);
    const remainingAttempts = 5 - attemptCount;

    return createEmailLayout({
        title: "Security Notice",
        subtitle: "Failed sign-in attempt detected",
        headerColor: "#dc2626",

        body: `
      <p style="font-size:16px;color:#111827;">
        Hello <strong>${email.split("@")[0]}</strong>,
      </p>

      <p style="
        color:#4b5563;
        font-size:15px;
        line-height:24px;
      ">
        We detected an unsuccessful sign-in attempt to your account.
        ${remainingAttempts > 0 ? `You have ${remainingAttempts} attempt(s) remaining before your account is locked.` : ''}
      </p>

      <div style="
        background:#f9fafb;
        border:1px solid #e5e7eb;
        border-radius:12px;
        padding:20px;
        margin-top:25px;
      ">

        <table width="100%" style="font-size:14px;">

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Attempt Number
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${attemptCount}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Time
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${time} IST
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              IP Address
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${ip}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Location
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${locationText}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Device
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${device.device}
            </td>
          </tr>

        </table>

      </div>

      <div style="
        background:#fef3c7;
        border-radius:10px;
        padding:16px;
        margin-top:20px;
      ">
        <p style="
          margin:0;
          color:#92400e;
          font-size:13px;
          line-height:22px;
        ">
          If this was not you, consider updating your password immediately.
        </p>
      </div>
    `,
    });
}

// ======================================================
// PASSWORD CHANGED
// ======================================================

async function getPasswordChangedConfirmationEmail(email, name) {
    const time = getISTTime();
    
    return createEmailLayout({
        title: "Password Updated",
        subtitle: "Your password was changed successfully",
        headerColor: "#059669",

        body: `
      <p style="font-size:16px;color:#111827;">
        Hello <strong>${name}</strong>,
      </p>

      <p style="
        color:#4b5563;
        font-size:15px;
        line-height:24px;
      ">
        Your account password was updated successfully on ${time} IST.
      </p>

      <div style="
        background:#ecfdf5;
        border-radius:10px;
        padding:16px;
        margin-top:20px;
      ">
        <p style="
          margin:0;
          color:#065f46;
          font-size:13px;
          line-height:22px;
        ">
          If you did not make this change,
          please secure your account immediately.
        </p>
      </div>
    `,
    });
}

// ======================================================
// WELCOME EMAIL
// ======================================================

async function getWelcomeEmail(name, email) {
    return createEmailLayout({
        title: "Welcome",
        subtitle: "Your account has been created",
        headerColor: "#4f46e5",

        body: `
      <p style="font-size:16px;color:#111827;">
        Hello <strong>${name}</strong>,
      </p>

      <p style="
        color:#4b5563;
        font-size:15px;
        line-height:24px;
      ">
        Welcome to Business Manager (Nitish Software).
        Your account setup is complete and ready to use.
      </p>

      <div style="
        background:#f9fafb;
        border-radius:12px;
        padding:20px;
        margin-top:25px;
      ">

        <h3 style="
          margin-top:0;
          color:#111827;
          font-size:16px;
        ">
          Available Features
        </h3>

        <ul style="
          color:#4b5563;
          line-height:28px;
          padding-left:20px;
        ">
          <li>Attendance management</li>
          <li>Invoice and billing</li>
          <li>Worker management</li>
          <li>Analytics dashboard</li>
        </ul>

      </div>

      <div style="
        text-align:center;
        margin-top:30px;
      ">

        <a
          href="${process.env.FRONTEND_URL || "http://localhost:5173"}"
          style="
            display:inline-block;
            background:#4f46e5;
            color:#ffffff;
            text-decoration:none;
            padding:14px 30px;
            border-radius:10px;
            font-weight:600;
          "
        >
          Open Dashboard
        </a>

      </div>
    `,
    });
}

// ======================================================
// EXCESSIVE ATTEMPTS ALERT
// ======================================================

async function getExcessiveAttemptsAlertEmail(email, attemptCount, req) {
    const location = await getLocationFromIP(req);
    
    let ip = req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.ip;

    if (ip && ip.startsWith("::ffff:")) {
        ip = ip.substring(7);
    }
    
    if (ip && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
    }

    const time = getISTTime();
    const locationText = formatLocation(location);

    return createEmailLayout({
        title: "Account Protection Alert",
        subtitle: "Multiple failed sign-in attempts detected",
        headerColor: "#b91c1c",

        body: `
      <p style="font-size:16px;color:#111827;">
        Hello <strong>${email.split("@")[0]}</strong>,
      </p>

      <p style="
        color:#4b5563;
        font-size:15px;
        line-height:24px;
      ">
        Your account has been temporarily protected
        due to multiple unsuccessful login attempts.
      </p>

      <div style="
        background:#f9fafb;
        border:1px solid #e5e7eb;
        border-radius:12px;
        padding:20px;
        margin-top:25px;
      ">

        <table width="100%" style="font-size:14px;">

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Failed Attempts
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${attemptCount}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Time
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${time} IST
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              IP Address
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${ip}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;color:#6b7280;">
              Location
            </td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">
              ${locationText}
            </td>
          </tr>

        </table>

      </div>

      <div style="
        background:#fef2f2;
        border-radius:10px;
        padding:16px;
        margin-top:20px;
      ">
        <p style="
          margin:0;
          color:#991b1b;
          font-size:13px;
          line-height:22px;
        ">
          Your account is temporarily locked. Please try again after 15 minutes.
          If you're having trouble accessing your account, use the "Forgot Password" option.
        </p>
      </div>
    `,
    });
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