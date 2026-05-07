// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken"); // ← ADD THIS LINE
const authMiddleware = require("../middleware/authMiddleware");
const { JWT_SECRET, OTP_STORE } = require("../utils/constants");
const {
  sendOTP,
  verifyOTP,
  register,
  login,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const {
  updateCompanyDetails,
  getCompanyDetails,
  uploadLogo,
  deleteLogo,
  upload,
} = require("../controllers/companyController");
const User = require("../models/User");
// Auth Routes
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
// Verify Reset OTP
router.post("/verify-reset-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const otpKey = `reset_${email}`;
    const storedData = OTP_STORE[otpKey];
    
    if (!storedData) {
      return res.status(400).json({ msg: "No OTP found. Please request a new one." });
    }
    
    if (Date.now() > storedData.expiresAt) {
      delete OTP_STORE[otpKey];
      return res.status(400).json({ msg: "OTP has expired. Please request a new one." });
    }
    
    if (storedData.otp !== otp) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }
    
    // Generate a temporary reset token
    const resetToken = jwt.sign(
      { email: email, purpose: "password_reset" },
      JWT_SECRET,
      { expiresIn: "10m" }
    );
    
    // Clear OTP after successful verification
    delete OTP_STORE[otpKey];
    
    res.json({ 
      success: true, 
      token: resetToken,
      msg: "OTP verified successfully" 
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "OTP verification failed" });
  }
});
router.post("/reset-password", resetPassword);

// User Routes (Protected)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching user" });
  }
});

router.get("/login-history", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("loginHistory");
    res.json({ loginHistory: user.loginHistory || [] });
  } catch (err) {
    res.status(500).json({ msg: "Error fetching login history" });
  }
});

// Company Routes
router.put("/company-details", authMiddleware, updateCompanyDetails);
router.get("/company-details", authMiddleware, getCompanyDetails);
router.post("/upload-logo", authMiddleware, upload.single("logo"), uploadLogo);
router.delete("/delete-logo", authMiddleware, deleteLogo);

module.exports = router;