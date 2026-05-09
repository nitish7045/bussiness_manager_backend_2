// backend/models/User.js

const mongoose = require("mongoose");

// ======================================================
// LOGIN HISTORY SCHEMA
// ======================================================

const loginHistorySchema = new mongoose.Schema({

  timestamp: {
    type: Date,
    default: Date.now,
  },

  ip: {
    type: String,
    default: "",
  },

  userAgent: {
    type: String,
    default: "",
  },

  location: {
    type: String,
    default: "",
  },

  device: {
    type: String,
    default: "",
  },

  os: {
    type: String,
    default: "",
  },

  browser: {
    type: String,
    default: "",
  },

  success: {
    type: Boolean,
    default: true,
  },

});

// ======================================================
// FAILED ATTEMPT SCHEMA
// ======================================================

const failedAttemptSchema = new mongoose.Schema({

  timestamp: {
    type: Date,
    default: Date.now,
  },

  ip: {
    type: String,
    default: "",
  },

  userAgent: {
    type: String,
    default: "",
  },

  location: {
    type: String,
    default: "",
  },

});

// ======================================================
// MAIN USER SCHEMA
// ======================================================

const userSchema = new mongoose.Schema({

  // BASIC INFO

  name: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  password: {
    type: String,
    required: true,
  },

  companyId: {
    type: String,
    required: true,
    unique: true,
  },

  // ======================================================
  // COMPANY DETAILS
  // ======================================================

  companyDetails: {

    name: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      default: "",
    },

    gst: {
      type: String,
      default: "",
    },

    logo: {
      type: String,
      default: null,
    },

    website: {
      type: String,
      default: "",
    },

    pan: {
      type: String,
      default: "",
    },

    // ======================================================
    // WHATSAPP NUMBER
    // ======================================================

    whatsappNumber: {

      type: String,

      unique: true,

      sparse: true,

      trim: true,

      validate: {

        validator: function(v) {

          if (!v) return true;

          const cleaned =
            v.replace(/\D/g, "");

          return (
            cleaned.length >= 10 &&
            cleaned.length <= 13
          );

        },

        message:
          "Invalid WhatsApp number",

      },

    },

  },

  // ======================================================
  // ROLE
  // ======================================================

  role: {

    type: String,

    enum: [
      "admin",
      "user",
      "super_admin",
    ],

    default: "user",

  },

  // ======================================================
  // ACCOUNT STATUS
  // ======================================================

  isActive: {
    type: Boolean,
    default: true,
  },

  isEmailVerified: {
    type: Boolean,
    default: false,
  },

  emailVerifiedAt: {
    type: Date,
    default: null,
  },

  // ======================================================
  // SECURITY
  // ======================================================

  lastLogin: {
    type: Date,
    default: null,
  },

  lastLoginIp: {
    type: String,
    default: "",
  },

  lastLoginDevice: {
    type: String,
    default: "",
  },

  lastPasswordChange: {
    type: Date,
    default: Date.now,
  },

  // ======================================================
  // RESET PASSWORD
  // ======================================================

  resetPasswordToken: {
    type: String,
    default: null,
  },

  resetPasswordExpires: {
    type: Date,
    default: null,
  },

  // ======================================================
  // 2FA
  // ======================================================

  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },

  twoFactorSecret: {
    type: String,
    default: null,
  },

  // ======================================================
  // LOGIN HISTORY
  // ======================================================

  loginHistory: [
    loginHistorySchema
  ],

  // ======================================================
  // FAILED ATTEMPTS
  // ======================================================

  failedAttempts: [
    failedAttemptSchema
  ],

  totalFailedAttempts: {
    type: Number,
    default: 0,
  },

  accountLockedUntil: {
    type: Date,
    default: null,
  },

  // ======================================================
  // TIMESTAMPS
  // ======================================================

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },

  lastActiveAt: {
    type: Date,
    default: Date.now,
  },

}, {
  timestamps: true,
});

// ======================================================
// INDEXES
// ======================================================

userSchema.index({
  "companyDetails.whatsappNumber": 1,
}, {
  unique: true,
  sparse: true,
});

userSchema.index({
  "companyDetails.gst": 1,
});

userSchema.index({
  createdAt: -1,
});

userSchema.index({
  lastLogin: -1,
});

// ======================================================
// VIRTUAL
// ======================================================

userSchema.virtual(
  "fullCompanyDetails"
).get(function() {

  return {

    ...this.companyDetails,

    companyId:
      this.companyId,

    ownerName:
      this.name,

    ownerEmail:
      this.email,

  };

});

// ======================================================
// LOGIN HISTORY METHOD
// ======================================================

userSchema.methods.addLoginHistory =
function(loginData) {

  this.loginHistory.push({

    timestamp: new Date(),

    ip: loginData.ip,

    userAgent:
      loginData.userAgent,

    location:
      loginData.location || "",

    device:
      loginData.device || "",

    os:
      loginData.os || "",

    browser:
      loginData.browser || "",

    success:
      loginData.success !== false,

  });

  if (
    this.loginHistory.length > 50
  ) {

    this.loginHistory =
      this.loginHistory.slice(-50);

  }

  if (loginData.success) {

    this.lastLogin =
      new Date();

    this.lastLoginIp =
      loginData.ip;

    this.lastLoginDevice =
      loginData.device || "";

    this.lastActiveAt =
      new Date();

  }

  return this.save();

};

// ======================================================
// FAILED ATTEMPT METHOD
// ======================================================

userSchema.methods.addFailedAttempt =
async function(attemptData) {

  this.failedAttempts.push({

    timestamp: new Date(),

    ip: attemptData.ip,

    userAgent:
      attemptData.userAgent,

    location:
      attemptData.location || "",

  });

  this.totalFailedAttempts += 1;

  if (
    this.failedAttempts.length > 20
  ) {

    this.failedAttempts =
      this.failedAttempts.slice(-20);

  }

  const recentAttempts =
    this.failedAttempts.filter(
      attempt =>
        attempt.timestamp >
        new Date(
          Date.now() -
          15 * 60 * 1000
        )
    );

  if (
    recentAttempts.length >= 5 &&
    !this.accountLockedUntil
  ) {

    this.accountLockedUntil =
      new Date(
        Date.now() +
        15 * 60 * 1000
      );

  }

  return this.save();

};

// ======================================================
// CLEAR FAILED ATTEMPTS
// ======================================================

userSchema.methods.clearFailedAttempts =
function() {

  this.failedAttempts = [];

  this.totalFailedAttempts = 0;

  this.accountLockedUntil = null;

  return this.save();

};

// ======================================================
// ACCOUNT LOCK CHECK
// ======================================================

userSchema.methods.isAccountLocked =
function() {

  if (
    this.accountLockedUntil &&
    this.accountLockedUntil >
    new Date()
  ) {

    return true;

  }

  if (
    this.accountLockedUntil &&
    this.accountLockedUntil <=
    new Date()
  ) {

    this.accountLockedUntil =
      null;

    this.save();

  }

  return false;

};

// ======================================================
// UPDATE LAST ACTIVE
// ======================================================

userSchema.methods.updateLastActive =
function() {

  this.lastActiveAt =
    new Date();

  return this.save();

};

// ======================================================
// VERIFY EMAIL
// ======================================================

userSchema.methods.verifyEmail =
function() {

  this.isEmailVerified = true;

  this.emailVerifiedAt =
    new Date();

  return this.save();

};

// ======================================================
// CHANGE PASSWORD
// ======================================================

userSchema.methods.changePassword =
async function(newPassword) {

  const bcrypt =
    require("bcryptjs");

  this.password =
    await bcrypt.hash(
      newPassword,
      10
    );

  this.lastPasswordChange =
    new Date();

  this.resetPasswordToken =
    null;

  this.resetPasswordExpires =
    null;

  return this.save();

};

// ======================================================
// STATIC METHODS
// ======================================================

userSchema.statics.findByEmail =
function(email) {

  return this.findOne({
    email:
      email.toLowerCase(),
  });

};

userSchema.statics.getActiveUsersCount =
function() {

  return this.countDocuments({
    isActive: true,
  });

};

// ======================================================
// PRE SAVE MIDDLEWARE
// ======================================================

userSchema.pre(
  "save",
  function(next) {

    this.updatedAt =
      new Date();

    if (this.email) {

      this.email =
        this.email.toLowerCase();

    }

    next();

  }
);

// ======================================================
// GENERATE COMPANY ID
// ======================================================

userSchema.pre(
  "save",
  async function(next) {

    if (
      !this.companyId ||
      this.companyId ===
      Date.now().toString()
    ) {

      const timestamp =
        Date.now();

      const random =
        Math.floor(
          Math.random() * 10000
        );

      this.companyId =
        `COMP${timestamp}${random}`;

    }

    next();

  }
);

// ======================================================
// EXPORT
// ======================================================

module.exports =
mongoose.model(
  "User",
  userSchema
);