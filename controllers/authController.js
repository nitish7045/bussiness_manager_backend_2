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
// FORMAT WHATSAPP NUMBER
// ======================================================

function formatWhatsAppNumber(number) {

  if (!number) return null;

  number = number.replace(/\D/g, "");

  if (!number.startsWith("91")) {
    number = `91${number}`;
  }

  return number;

}

// ======================================================
// SEND OTP
// ======================================================

const sendOTP = async (req, res) => {

  try {

    const { email } = req.body;

    if (!email) {

      return res.status(400).json({
        success: false,
        msg: "Email is required",
      });

    }

    const existingUser =
      await User.findOne({ email });

    if (existingUser) {

      return res.status(400).json({
        success: false,
        msg: "User already exists with this email",
      });

    }

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    OTP_STORE[email] = otp;

    res.json({
      success: true,
      msg: "OTP sent successfully",
    });

    setImmediate(async () => {

      sendOTPEmail(email, otp)
        .catch(console.error);

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
// VERIFY OTP
// ======================================================

const verifyOTP = async (req, res) => {

  try {

    const { email, otp } = req.body;

    if (!email || !otp) {

      return res.status(400).json({
        success: false,
        msg: "Email and OTP required",
      });

    }

    if (!OTP_STORE[email]) {

      return res.status(400).json({
        success: false,
        msg: "No OTP found",
      });

    }

    if (OTP_STORE[email] !== otp) {

      return res.status(400).json({
        success: false,
        msg: "Invalid OTP",
      });

    }

    delete OTP_STORE[email];

    res.json({
      success: true,
      msg: "OTP verified",
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      msg: "OTP verification failed",
    });

  }

};

// ======================================================
// REGISTER
// ======================================================

const register = async (req, res) => {

  try {

    const {
      name,
      email,
      password,
    } = req.body;

    const existingUser =
      await User.findOne({ email });

    if (existingUser) {

      return res.status(400).json({
        success: false,
        msg: "User already exists",
      });

    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const user = new User({

      name,

      email,

      password: hashedPassword,

      companyId:
        `COMP${Date.now()}${Math.floor(Math.random() * 10000)}`,

      companyDetails: {
        name: "",
        phone: "",
        email,
        address: "",
        gst: "",
        logo: null,
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

    setImmediate(async () => {

      // EMAIL
      sendWelcomeEmailMessage(
        name,
        email
      ).catch(console.error);

      // WHATSAPP
      try {

        let whatsappNumber =
          formatWhatsAppNumber(
            user.companyDetails?.whatsappNumber
          );

        if (whatsappNumber) {

          const whatsappMessage =
            await getWelcomeWhatsApp(name);

          await sendWhatsAppMessage(
            whatsappNumber,
            whatsappMessage
          );

        }

      } catch (err) {

        console.error(
          "Welcome WhatsApp Error:",
          err.message
        );

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

    const { email, password } =
      req.body;

    if (!email || !password) {

      return res.status(400).json({
        success: false,
        msg: "Email and password required",
      });

    }

    const attemptData =
      LOGIN_ATTEMPTS.get(email);

    if (
      attemptData &&
      attemptData.lockUntil &&
      attemptData.lockUntil > Date.now()
    ) {

      const minutesLeft =
        Math.ceil(
          (attemptData.lockUntil - Date.now()) / 60000
        );

      return res.status(403).json({
        success: false,
        msg:
          `Account locked. Try again after ${minutesLeft} minutes.`,
      });

    }

    const user =
      await User.findOne({ email });

    if (!user) {

      const newAttempts =
        updateLoginAttempts(email, false);

      setImmediate(async () => {

        sendWrongPasswordAlert(
          email,
          newAttempts.count,
          req
        ).catch(console.error);

      });

      return res.status(401).json({
        success: false,
        msg: "Invalid email or password",
      });

    }

    const isMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isMatch) {

      const newAttempts =
        updateLoginAttempts(email, false);

      const remainingAttempts =
        5 - newAttempts.count;

      setImmediate(async () => {

        // EMAIL
        sendWrongPasswordAlert(
          email,
          newAttempts.count,
          req
        ).catch(console.error);

        // WHATSAPP
        try {

          let whatsappNumber =
            formatWhatsAppNumber(
              user.companyDetails?.whatsappNumber
            );

          if (whatsappNumber) {

            const whatsappMessage =
              await getWrongPasswordWhatsApp(
                email,
                newAttempts.count
              );

            await sendWhatsAppMessage(
              whatsappNumber,
              whatsappMessage
            );

          }

        } catch (err) {

          console.error(
            "Wrong Password WhatsApp Error:",
            err.message
          );

        }

      });

      if (newAttempts.count >= 5) {

        setImmediate(async () => {

          sendExcessiveAttemptsAlert(
            email,
            newAttempts.count,
            req
          ).catch(console.error);

        });

        return res.status(403).json({
          success: false,
          msg:
            "Too many failed attempts. Account locked for 15 minutes.",
        });

      }

      return res.status(401).json({
        success: false,
        msg:
          `Invalid password. ${remainingAttempts} attempts remaining.`,
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

    let ip =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip;

    if (
      ip &&
      ip.startsWith("::ffff:")
    ) {
      ip = ip.substring(7);
    }

    // SAVE LOGIN HISTORY
    setImmediate(async () => {

      try {

        user.lastLogin = new Date();

        user.loginHistory =
          user.loginHistory || [];

        const location =
          await getLocationFromIP(req);

        user.loginHistory.unshift({

          timestamp: new Date(),

          ip,

          userAgent:
            req.headers["user-agent"],

          location:
            `${location.city}, ${location.country}`,

        });

        if (
          user.loginHistory.length > 50
        ) {

          user.loginHistory =
            user.loginHistory.slice(0, 50);

        }

        await user.save();

      } catch (err) {

        console.error(
          "Save Login Error:",
          err.message
        );

      }

    });

    // SEND NOTIFICATIONS
    setImmediate(async () => {

      // EMAIL
      try {

        const newLocationDetected =
          isNewLocation(user, req);

        await sendLoginNotification(
          email,
          req,
          newLocationDetected
        );

      } catch (err) {

        console.error(
          "Login Email Error:",
          err.message
        );

      }

      // WHATSAPP
      try {

        let whatsappNumber =
          formatWhatsAppNumber(
            user.companyDetails?.whatsappNumber
          );

        if (whatsappNumber) {

          const whatsappMessage =
            await getLoginNotificationWhatsApp(
              user.email,
              req
            );

          await sendWhatsAppMessage(
            whatsappNumber,
            whatsappMessage
          );

        }

      } catch (err) {

        console.error(
          "Login WhatsApp Error:",
          err.message
        );

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

    const user =
      await User.findOne({ email });

    if (!user) {

      return res.status(404).json({
        success: false,
        msg: "User not found",
      });

    }

    const otp =
      otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      });

    OTP_STORE[`reset_${email}`] = {
      otp,
      expiresAt:
        Date.now() + 15 * 60 * 1000,
    };

    res.json({
      success: true,
      msg: "OTP sent successfully",
    });

    setImmediate(async () => {

      // EMAIL
      sendPasswordResetOTP(
        email,
        user.name,
        otp
      ).catch(console.error);

      // WHATSAPP
      try {

        let whatsappNumber =
          formatWhatsAppNumber(
            user.companyDetails?.whatsappNumber
          );

        if (whatsappNumber) {

          const whatsappMessage =
            await getPasswordResetOTPWhatsApp(
              user.name,
              otp
            );

          await sendWhatsAppMessage(
            whatsappNumber,
            whatsappMessage
          );

        }

      } catch (err) {

        console.error(
          "Reset OTP WhatsApp Error:",
          err.message
        );

      }

    });

  } catch (err) {

    console.error(
      "Forgot Password Error:",
      err
    );

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

    const {
      email,
      token,
      newPassword,
    } = req.body;

    const decoded =
      jwt.verify(token, JWT_SECRET);

    if (
      decoded.email !== email
    ) {

      return res.status(400).json({
        success: false,
        msg: "Invalid token",
      });

    }

    const user =
      await User.findOne({ email });

    if (!user) {

      return res.status(404).json({
        success: false,
        msg: "User not found",
      });

    }

    user.password =
      await bcrypt.hash(
        newPassword,
        10
      );

    user.lastPasswordChange =
      new Date();

    await user.save();

    res.json({
      success: true,
      msg:
        "Password reset successful",
    });

    setImmediate(async () => {

      // EMAIL
      sendPasswordChangedConfirmation(
        email,
        user.name
      ).catch(console.error);

      // WHATSAPP
      try {

        let whatsappNumber =
          formatWhatsAppNumber(
            user.companyDetails?.whatsappNumber
          );

        if (whatsappNumber) {

          const whatsappMessage =
            await getPasswordChangedWhatsApp(
              user.name
            );

          await sendWhatsAppMessage(
            whatsappNumber,
            whatsappMessage
          );

        }

      } catch (err) {

        console.error(
          "Password Changed WhatsApp Error:",
          err.message
        );

      }

    });

  } catch (err) {

    console.error(
      "Reset Password Error:",
      err
    );

    res.status(500).json({
      success: false,
      msg:
        "Failed to reset password",
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
};