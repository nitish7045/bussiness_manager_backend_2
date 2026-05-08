// backend/models/User.js
const mongoose = require("mongoose");

// Login History Schema
const loginHistorySchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  ip: {
    type: String,
    default: ""
  },
  userAgent: {
    type: String,
    default: ""
  },
  location: {
    type: String,
    default: ""
  },
  device: {
    type: String,
    default: ""
  },
  os: {
    type: String,
    default: ""
  },
  browser: {
    type: String,
    default: ""
  },
  success: {
    type: Boolean,
    default: true
  }
});

// Failed Attempt Schema
const failedAttemptSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  ip: {
    type: String,
    default: ""
  },
  userAgent: {
    type: String,
    default: ""
  },
  location: {
    type: String,
    default: ""
  }
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  companyId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Company Details with Logo stored as Base64
  companyDetails: {
  name: { type: String, default: "" },
  phone: { type: String, default: "" },
  email: { type: String, default: "" },
  address: { type: String, default: "" },
  gst: { type: String, default: "" },
  logo: { type: String, default: null },
  website: { type: String, default: "" },
  pan: { type: String, default: "" },

  // WhatsApp Notification Settings
  whatsappNumber: { type: String, default: "" },
  whatsappApiKey: { type: String, default: "" }
},
  
  // Role Management
  role: {
    type: String,
    enum: ["admin", "user", "super_admin"],
    default: "user"
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerifiedAt: {
    type: Date,
    default: null
  },
  
  // Security Fields
  lastLogin: {
    type: Date,
    default: null
  },
  lastLoginIp: {
    type: String,
    default: ""
  },
  lastLoginDevice: {
    type: String,
    default: ""
  },
  lastPasswordChange: {
    type: Date,
    default: Date.now
  },
  
  // Password Reset
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  
  // 2FA (Future Implementation)
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: null
  },
  
  // Login History
  loginHistory: [loginHistorySchema],
  
  // Failed Login Attempts (stored in DB for persistent tracking)
  failedAttempts: [failedAttemptSchema],
  totalFailedAttempts: {
    type: Number,
    default: 0
  },
  accountLockedUntil: {
    type: Date,
    default: null
  },
  
  // Account Creation
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Last Activity
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // This will automatically manage createdAt and updatedAt
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ companyId: 1 });
userSchema.index({ "companyDetails.gst": 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });

// Virtual for full company details
userSchema.virtual('fullCompanyDetails').get(function() {
  return {
    ...this.companyDetails,
    companyId: this.companyId,
    ownerName: this.name,
    ownerEmail: this.email
  };
});

// Method to add login history
userSchema.methods.addLoginHistory = function(loginData) {
  this.loginHistory.push({
    timestamp: new Date(),
    ip: loginData.ip,
    userAgent: loginData.userAgent,
    location: loginData.location || "",
    device: loginData.device || "",
    os: loginData.os || "",
    browser: loginData.browser || "",
    success: loginData.success !== false
  });
  
  // Keep only last 50 logins
  if (this.loginHistory.length > 50) {
    this.loginHistory = this.loginHistory.slice(-50);
  }
  
  if (loginData.success) {
    this.lastLogin = new Date();
    this.lastLoginIp = loginData.ip;
    this.lastLoginDevice = loginData.device || "";
    this.lastActiveAt = new Date();
  }
  
  return this.save();
};

// Method to add failed attempt
userSchema.methods.addFailedAttempt = async function(attemptData) {
  this.failedAttempts.push({
    timestamp: new Date(),
    ip: attemptData.ip,
    userAgent: attemptData.userAgent,
    location: attemptData.location || ""
  });
  
  this.totalFailedAttempts += 1;
  
  // Keep only last 20 failed attempts
  if (this.failedAttempts.length > 20) {
    this.failedAttempts = this.failedAttempts.slice(-20);
  }
  
  // Lock account after 5 failed attempts in last 15 minutes
  const recentAttempts = this.failedAttempts.filter(attempt => 
    attempt.timestamp > new Date(Date.now() - 15 * 60 * 1000)
  );
  
  if (recentAttempts.length >= 5 && !this.accountLockedUntil) {
    this.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
  }
  
  return this.save();
};

// Method to clear failed attempts (on successful login)
userSchema.methods.clearFailedAttempts = function() {
  this.failedAttempts = [];
  this.totalFailedAttempts = 0;
  this.accountLockedUntil = null;
  return this.save();
};

// Method to check if account is locked
userSchema.methods.isAccountLocked = function() {
  if (this.accountLockedUntil && this.accountLockedUntil > new Date()) {
    return true;
  }
  // Auto-unlock if lock time has passed
  if (this.accountLockedUntil && this.accountLockedUntil <= new Date()) {
    this.accountLockedUntil = null;
    this.save();
  }
  return false;
};

// Method to update last active
userSchema.methods.updateLastActive = function() {
  this.lastActiveAt = new Date();
  return this.save();
};

// Method to verify email
userSchema.methods.verifyEmail = function() {
  this.isEmailVerified = true;
  this.emailVerifiedAt = new Date();
  return this.save();
};

// Method to change password
userSchema.methods.changePassword = async function(newPassword) {
  const bcrypt = require("bcryptjs");
  this.password = await bcrypt.hash(newPassword, 10);
  this.lastPasswordChange = new Date();
  this.resetPasswordToken = null;
  this.resetPasswordExpires = null;
  return this.save();
};

// Static method to find by email with case-insensitive search
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to get active users count
userSchema.statics.getActiveUsersCount = function() {
  return this.countDocuments({ isActive: true });
};

// Middleware to update updatedAt on save
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  next();
});

// Middleware to generate companyId if not exists
userSchema.pre('save', async function(next) {
  if (!this.companyId || this.companyId === Date.now().toString()) {
    // Generate unique company ID
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    this.companyId = `COMP${timestamp}${random}`;
  }
  next();
});

module.exports = mongoose.model("User", userSchema);