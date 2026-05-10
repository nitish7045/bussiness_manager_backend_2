// backend/controllers/authController.js

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const otpGenerator = require("otp-generator");

const {
  JWT_SECRET,
  OTP_STORE,
  LOGIN_ATTEMPTS,
} = require("../utils/constants");

const {
  updateLoginAttempts,
  isNewLocation,
} = require("../services/authService");

const {
  getLocationFromIP,
} = require("../services/locationService");

// EMAIL FUNCTIONS
const {
  sendWrongPasswordAlert,
  sendLoginNotification,
  sendExcessiveAttemptsAlert,
  sendWelcomeEmailMessage,
  sendOTPEmail,
  sendPasswordResetOTP,
  sendPasswordChangedConfirmation,
} = require("./emailController");

// WHATSAPP SERVICE
const {
  sendWhatsAppMessage,
} = require("../services/whatsappService");

// WHATSAPP TEMPLATES
const {
  getOTPWhatsApp,
  getPasswordResetOTPWhatsApp,
  getLoginNotificationWhatsApp,
  getWrongPasswordWhatsApp,
  getPasswordChangedWhatsApp,
  getWelcomeWhatsApp,
  getExcessiveAttemptsWhatsApp,
} = require("../utils/whatsappTemplates");

// ======================================================
// FORMAT WHATSAPP NUMBER (For Indian Numbers)
// ======================================================

function formatWhatsAppNumber(number) {
  if (!number) return null;
  
  // Remove all non-digit characters
  number = number.replace(/\D/g, "");
  
  // If number is 10 digits (Indian number without country code)
  if (number.length === 10) {
    number = `91${number}`;
  }
  // If number is 12 digits starting with 91
  else if (number.length === 12 && number.startsWith("91")) {
    number = number;
  }
  // If number is 11 digits starting with 0
  else if (number.length === 11 && number.startsWith("0")) {
    number = `91${number.substring(1)}`;
  }
  
  // Final validation - should be 12 digits (91 + 10 digits)
  if (number.length !== 12) {
    return null;
  }
  
  return number;
}

// ======================================================
// SEND OTP (Modified for WhatsApp)
// ======================================================

const sendOTP = async (req, res) => {
  try {
    const { email, whatsappNumber } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        msg: "Email is required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        msg: "User already exists with this email",
      });
    }

    // Generate OTP
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    // Store OTP with both email and whatsappNumber as key
    OTP_STORE[email] = {
      otp: otp,
      whatsappNumber: whatsappNumber,
      createdAt: Date.now()
    };
    
    // Also store with whatsapp number as key for easy lookup
    if (whatsappNumber) {
      const formattedNumber = formatWhatsAppNumber(whatsappNumber);
      if (formattedNumber) {
        OTP_STORE[formattedNumber] = {
          otp: otp,
          email: email,
          createdAt: Date.now()
        };
      }
    }

    // Send success response immediately
    res.json({
      success: true,
      msg: "OTP sent successfully to your email and WhatsApp",
    });

    // Send OTPs asynchronously
    setImmediate(async () => {
      // Send OTP via Email
      try {
        await sendOTPEmail(email, otp);
        console.log(`OTP email sent to ${email}`);
      } catch (err) {
        console.error("Email OTP Error:", err.message);
      }

      // Send OTP via WhatsApp if number provided
      if (whatsappNumber) {
        try {
          const formattedNumber = formatWhatsAppNumber(whatsappNumber);
          if (formattedNumber) {
            const whatsappMessage = await getOTPWhatsApp("User", otp);
            await sendWhatsAppMessage(formattedNumber, whatsappMessage);
            console.log(`OTP WhatsApp sent to ${formattedNumber}`);
          } else {
            console.error("Invalid WhatsApp number format:", whatsappNumber);
          }
        } catch (err) {
          console.error("WhatsApp OTP Error:", err.message);
        }
      }
    });

  } catch (err) {
    console.error("Send OTP Error:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to send OTP",
    });
  }
};

// ======================================================
// VERIFY OTP (Modified for WhatsApp support)
// ======================================================

const verifyOTP = async (req, res) => {
  try {
    const { email, whatsappNumber, otp } = req.body;

    if ((!email && !whatsappNumber) || !otp) {
      return res.status(400).json({
        success: false,
        msg: "Email or WhatsApp number and OTP required",
      });
    }

    let storedOtpData = null;
    let identifier = null;

    // Try to find OTP by email first
    if (email && OTP_STORE[email]) {
      storedOtpData = OTP_STORE[email];
      identifier = email;
    }
    // If not found by email, try by formatted whatsapp number
    else if (whatsappNumber) {
      const formattedNumber = formatWhatsAppNumber(whatsappNumber);
      if (formattedNumber && OTP_STORE[formattedNumber]) {
        storedOtpData = OTP_STORE[formattedNumber];
        identifier = formattedNumber;
      }
    }

    if (!storedOtpData) {
      return res.status(400).json({
        success: false,
        msg: "No OTP found. Please request a new OTP.",
      });
    }

    // Check if OTP expired (5 minutes = 300000 ms)
    if (Date.now() - storedOtpData.createdAt > 300000) {
      delete OTP_STORE[identifier];
      return res.status(400).json({
        success: false,
        msg: "OTP has expired. Please request a new OTP.",
      });
    }

    // Verify OTP
    if (storedOtpData.otp !== otp) {
      return res.status(400).json({
        success: false,
        msg: "Invalid OTP. Please try again.",
      });
    }

    // Delete OTP after successful verification
    delete OTP_STORE[identifier];
    
    // Also delete the other reference if exists
    if (email && OTP_STORE[email]) {
      delete OTP_STORE[email];
    }
    if (whatsappNumber) {
      const formattedNumber = formatWhatsAppNumber(whatsappNumber);
      if (formattedNumber && OTP_STORE[formattedNumber]) {
        delete OTP_STORE[formattedNumber];
      }
    }

    res.json({
      success: true,
      msg: "OTP verified successfully",
    });

  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({
      success: false,
      msg: "OTP verification failed",
    });
  }
};

// ======================================================
// REGISTER (Modified to save WhatsApp number)
// ======================================================

const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      whatsappNumber,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        msg: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Format WhatsApp number for storage
    const formattedWhatsapp = whatsappNumber ? formatWhatsAppNumber(whatsappNumber) : null;

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
        logo: null,
        whatsappNumber: formattedWhatsapp,
      },
      loginHistory: [],
      createdAt: new Date(),
      isActive: true,
      isEmailVerified: true,
    });

    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        companyId: user.companyId,
      },
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
        companyId: user.companyId,
      },
      msg: "Registration successful",
    });

    // Send welcome notifications asynchronously
    setImmediate(async () => {
      // Send Welcome Email
      try {
        await sendWelcomeEmailMessage(name, email);
        console.log(`Welcome email sent to ${email}`);
      } catch (err) {
        console.error("Welcome Email Error:", err.message);
      }

      // Send Welcome WhatsApp
      if (formattedWhatsapp) {
        try {
          const whatsappMessage = await getWelcomeWhatsApp(name);
          await sendWhatsAppMessage(formattedWhatsapp, whatsappMessage);
          console.log(`Welcome WhatsApp sent to ${formattedWhatsapp}`);
        } catch (err) {
          console.error("Welcome WhatsApp Error:", err.message);
        }
      }
    });

  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({
      success: false,
      msg: "Registration failed",
    });
  }
};

// ======================================================
// LOGIN
// ======================================================

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        msg: "Email and password required",
      });
    }

    const attemptData = LOGIN_ATTEMPTS.get(email);

    if (attemptData && attemptData.lockUntil && attemptData.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((attemptData.lockUntil - Date.now()) / 60000);
      return res.status(403).json({
        success: false,
        msg: `Account locked. Try again after ${minutesLeft} minutes.`,
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      const newAttempts = updateLoginAttempts(email, false);
      setImmediate(async () => {
        sendWrongPasswordAlert(email, newAttempts.count, req).catch(console.error);
      });
      return res.status(401).json({
        success: false,
        msg: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      const newAttempts = updateLoginAttempts(email, false);
      const remainingAttempts = 5 - newAttempts.count;

      setImmediate(async () => {
        // EMAIL
        sendWrongPasswordAlert(email, newAttempts.count, req).catch(console.error);

        // WHATSAPP
        try {
          let whatsappNumber = formatWhatsAppNumber(user.companyDetails?.whatsappNumber);
          if (whatsappNumber) {
            const whatsappMessage = await getWrongPasswordWhatsApp(email, newAttempts.count);
            await sendWhatsAppMessage(whatsappNumber, whatsappMessage);
          }
        } catch (err) {
          console.error("Wrong Password WhatsApp Error:", err.message);
        }
      });

      if (newAttempts.count >= 5) {
        setImmediate(async () => {
          sendExcessiveAttemptsAlert(email, newAttempts.count, req).catch(console.error);
        });
        return res.status(403).json({
          success: false,
          msg: "Too many failed attempts. Account locked for 15 minutes.",
        });
      }

      return res.status(401).json({
        success: false,
        msg: `Invalid password. ${remainingAttempts} attempts remaining.`,
      });
    }

    updateLoginAttempts(email, true);

    const token = jwt.sign(
      {
        id: user._id,
        companyId: user.companyId,
      },
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
        companyId: user.companyId,
      },
      msg: "Login successful",
    });

    let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip;
    if (ip && ip.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }

    // SAVE LOGIN HISTORY
    setImmediate(async () => {
      try {
        user.lastLogin = new Date();
        user.loginHistory = user.loginHistory || [];
        const location = await getLocationFromIP(req);
        user.loginHistory.unshift({
          timestamp: new Date(),
          ip,
          userAgent: req.headers["user-agent"],
          location: `${location.city}, ${location.country}`,
        });
        if (user.loginHistory.length > 50) {
          user.loginHistory = user.loginHistory.slice(0, 50);
        }
        await user.save();
      } catch (err) {
        console.error("Save Login Error:", err.message);
      }
    });

    // SEND NOTIFICATIONS
    setImmediate(async () => {
      // EMAIL
      try {
        const newLocationDetected = isNewLocation(user, req);
        await sendLoginNotification(email, req, newLocationDetected);
      } catch (err) {
        console.error("Login Email Error:", err.message);
      }

      // WHATSAPP
      try {
        let whatsappNumber = formatWhatsAppNumber(user.companyDetails?.whatsappNumber);
        if (whatsappNumber) {
          const whatsappMessage = await getLoginNotificationWhatsApp(user.email, req);
          await sendWhatsAppMessage(whatsappNumber, whatsappMessage);
        }
      } catch (err) {
        console.error("Login WhatsApp Error:", err.message);
      }
    });

  } catch (err) {
    console.error("Login Error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        msg: "Login failed",
      });
    }
  }
};

// ======================================================
// FORGOT PASSWORD
// ======================================================

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found",
      });
    }

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    OTP_STORE[`reset_${email}`] = {
      otp,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };

    res.json({
      success: true,
      msg: "OTP sent successfully",
    });

    setImmediate(async () => {
      // EMAIL
      sendPasswordResetOTP(email, user.name, otp).catch(console.error);

      // WHATSAPP
      try {
        let whatsappNumber = formatWhatsAppNumber(user.companyDetails?.whatsappNumber);
        if (whatsappNumber) {
          const whatsappMessage = await getPasswordResetOTPWhatsApp(user.name, otp);
          await sendWhatsAppMessage(whatsappNumber, whatsappMessage);
        }
      } catch (err) {
        console.error("Reset OTP WhatsApp Error:", err.message);
      }
    });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to send OTP",
    });
  }
};

// ======================================================
// RESET PASSWORD
// ======================================================

const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.email !== email) {
      return res.status(400).json({
        success: false,
        msg: "Invalid token",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.lastPasswordChange = new Date();
    await user.save();

    res.json({
      success: true,
      msg: "Password reset successful",
    });

    setImmediate(async () => {
      // EMAIL
      sendPasswordChangedConfirmation(email, user.name).catch(console.error);

      // WHATSAPP
      try {
        let whatsappNumber = formatWhatsAppNumber(user.companyDetails?.whatsappNumber);
        if (whatsappNumber) {
          const whatsappMessage = await getPasswordChangedWhatsApp(user.name);
          await sendWhatsAppMessage(whatsappNumber, whatsappMessage);
        }
      } catch (err) {
        console.error("Password Changed WhatsApp Error:", err.message);
      }
    });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to reset password",
    });
  }
};

// ======================================================
// GET COMPANY DETAILS (NEW)
// ======================================================

const getCompanyDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found"
      });
    }
    
    res.json({
      success: true,
      companyDetails: user.companyDetails
    });
    
  } catch (err) {
    console.error("Get Company Details Error:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to fetch company details"
    });
  }
};

// ======================================================
// UPDATE COMPANY DETAILS (NEW)
// ======================================================

const updateCompanyDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { companyDetails } = req.body;
    
    // Format WhatsApp number if provided
    if (companyDetails.whatsappNumber) {
      companyDetails.whatsappNumber = formatWhatsAppNumber(companyDetails.whatsappNumber);
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { companyDetails: companyDetails },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found"
      });
    }
    
    res.json({
      success: true,
      msg: "Company details updated successfully",
      companyDetails: user.companyDetails
    });
    
  } catch (err) {
    console.error("Update Company Details Error:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to update company details"
    });
  }
};

// ======================================================
// UPLOAD LOGO (NEW)
// ======================================================

const uploadLogo = async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        msg: "No file uploaded"
      });
    }
    
    // Create logo URL
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { "companyDetails.logo": logoUrl },
      { new: true }
    );
    
    res.json({
      success: true,
      msg: "Logo uploaded successfully",
      logo: logoUrl
    });
    
  } catch (err) {
    console.error("Upload Logo Error:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to upload logo"
    });
  }
};

// ======================================================
// DELETE LOGO (NEW)
// ======================================================

const deleteLogo = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { "companyDetails.logo": null },
      { new: true }
    );
    
    res.json({
      success: true,
      msg: "Logo deleted successfully"
    });
    
  } catch (err) {
    console.error("Delete Logo Error:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to delete logo"
    });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  register,
  login,
  forgotPassword,
  resetPassword,
  getCompanyDetails,
  updateCompanyDetails,
  uploadLogo,
  deleteLogo,
};