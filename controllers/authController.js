// backend/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const otpGenerator = require("otp-generator");
const { JWT_SECRET, OTP_STORE, LOGIN_ATTEMPTS } = require("../utils/constants");
const { updateLoginAttempts, isNewLocation } = require("../services/authService");
const { getLocationFromIP } = require("../services/locationService");
const {
  sendWrongPasswordAlert,
  sendLoginNotification,
  sendExcessiveAttemptsAlert,
  sendWelcomeEmailMessage,
  sendOTPEmail,
  sendPasswordResetOTP,
  sendPasswordChangedConfirmation,
} = require("./emailController");

// Send OTP - OPTIMIZED
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, msg: "Email is required" });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, msg: "User already exists with this email" });
    }

    const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
    OTP_STORE[email] = otp;
    
    // SEND RESPONSE IMMEDIATELY
    res.json({ success: true, msg: "OTP sent successfully" });
    
    // Send email in background (Fire and Forget)
    sendOTPEmail(email, otp).catch(err => 
      console.error("Failed to send OTP email:", err.message)
    );
    
  } catch (err) {
    console.error("Send OTP Error:", err);
    res.status(500).json({ success: false, msg: "Failed to send OTP. Please try again." });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ success: false, msg: "Email and OTP are required" });
    }
    
    if (!OTP_STORE[email]) {
      return res.status(400).json({ success: false, msg: "No OTP found. Please request a new OTP." });
    }
    
    if (OTP_STORE[email] !== otp) {
      return res.status(400).json({ success: false, msg: "Invalid OTP. Please try again." });
    }
    
    delete OTP_STORE[email];
    res.json({ success: true, msg: "OTP verified successfully" });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ success: false, msg: "OTP verification failed. Please try again." });
  }
};

// Register - OPTIMIZED
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, msg: "All fields are required" });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, msg: "Password must be at least 6 characters" });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, msg: "User already exists with this email" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name, email, password: hashedPassword,
      companyId: `COMP${Date.now()}${Math.floor(Math.random() * 10000)}`,
      companyDetails: { name: "", phone: "", email, address: "", gst: "", logo: null },
      loginHistory: [], createdAt: new Date(), isActive: true, isEmailVerified: true
    });
    
    await user.save();

    const token = jwt.sign({ id: user._id, companyId: user.companyId }, JWT_SECRET, { expiresIn: "7d" });
    
    // SEND RESPONSE IMMEDIATELY
    res.json({ 
      success: true, 
      token, 
      user: { id: user._id, name: user.name, email: user.email, companyId: user.companyId },
      msg: "Registration successful!"
    });
    
    // Send welcome email in background (Fire and Forget)
    sendWelcomeEmailMessage(name, email).catch(err => 
      console.error("Failed to send welcome email:", err.message)
    );
    
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ success: false, msg: "Registration failed. Please try again." });
  }
};

// Login - OPTIMIZED
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, msg: "Email and password are required" });
    }
    
    const attemptData = LOGIN_ATTEMPTS.get(email);
    
    if (attemptData && attemptData.lockUntil && attemptData.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((attemptData.lockUntil - Date.now()) / 60000);
      return res.status(403).json({ success: false, msg: `Account locked. Try again after ${minutesLeft} minutes.` });
    }

    const user = await User.findOne({ email });
    if (!user) {
      const newAttempts = updateLoginAttempts(email, false);
      sendWrongPasswordAlert(email, newAttempts.count, req).catch(console.error);
      return res.status(401).json({ success: false, msg: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const newAttempts = updateLoginAttempts(email, false);
      const remainingAttempts = 5 - newAttempts.count;
      sendWrongPasswordAlert(email, newAttempts.count, req).catch(console.error);
      
      if (newAttempts.count >= 5) {
        sendExcessiveAttemptsAlert(email, newAttempts.count, req).catch(console.error);
        return res.status(403).json({ success: false, msg: "Too many failed attempts. Account locked for 15 minutes." });
      }
      return res.status(401).json({ success: false, msg: `Invalid password. ${remainingAttempts} attempts remaining.` });
    }

    updateLoginAttempts(email, true);
    const token = jwt.sign({ id: user._id, companyId: user.companyId }, JWT_SECRET, { expiresIn: "7d" });
    
    // SEND RESPONSE IMMEDIATELY
    res.json({ 
      success: true,
      token, 
      user: { id: user._id, name: user.name, email: user.email, companyId: user.companyId }, 
      msg: "Login successful" 
    });

    // Get IP address
    let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip;
    if (ip && ip.startsWith("::ffff:")) ip = ip.substring(7);

    // Save login history in background
    setImmediate(async () => {
      try {
        user.lastLogin = new Date();
        user.loginHistory = user.loginHistory || [];
        const location = await getLocationFromIP(req);
        user.loginHistory.unshift({ timestamp: new Date(), ip, userAgent: req.headers["user-agent"], location: `${location.city}, ${location.country}` });
        if (user.loginHistory.length > 50) user.loginHistory = user.loginHistory.slice(0, 50);
        await user.save();
      } catch (err) { console.error("Failed to save login history:", err.message); }
    });

    // Send email notification in background
    setImmediate(async () => {
      try {
        const newLocationDetected = isNewLocation(user, req);
        await sendLoginNotification(email, req, newLocationDetected);
      } catch (err) { console.error("Failed to send login email:", err.message); }
    });
  } catch (err) {
    console.error("Login Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, msg: "Login failed. Please try again." });
    }
  }
};

// Forgot Password - OPTIMIZED
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, msg: "Email is required" });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, msg: "No account found with this email address" });
    }

    const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
    OTP_STORE[`reset_${email}`] = { otp, expiresAt: Date.now() + 15 * 60 * 1000 };
    
    // SEND RESPONSE IMMEDIATELY
    res.json({ success: true, msg: "OTP sent to your email address" });
    
    // Send email in background (Fire and Forget)
    sendPasswordResetOTP(email, user.name, otp).catch(err => 
      console.error("Failed to send password reset email:", err.message)
    );
    
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ success: false, msg: "Failed to send OTP. Please try again." });
  }
};

// Reset Password - OPTIMIZED
const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    
    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, msg: "All fields are required" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, msg: "Password must be at least 6 characters" });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.email !== email || decoded.purpose !== "password_reset") {
      return res.status(400).json({ success: false, msg: "Invalid or expired reset token" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 10);
    user.lastPasswordChange = new Date();
    await user.save();
    
    // SEND RESPONSE IMMEDIATELY
    res.json({ success: true, msg: "Password reset successfully. You can now login with your new password." });
    
    // Send confirmation email in background (Fire and Forget)
    sendPasswordChangedConfirmation(email, user.name).catch(err => 
      console.error("Failed to send password change confirmation:", err.message)
    );
    
  } catch (err) {
    console.error("Reset Password Error:", err);
    if (err.name === 'JsonWebTokenError') {
      res.status(400).json({ success: false, msg: "Invalid or expired reset token. Please request a new one." });
    } else {
      res.status(500).json({ success: false, msg: "Failed to reset password. Please try again." });
    }
  }
};

module.exports = { sendOTP, verifyOTP, register, login, forgotPassword, resetPassword };