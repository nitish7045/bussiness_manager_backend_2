// backend/utils/constants.js
module.exports = {
  JWT_SECRET: "secretkey",
  OTP_STORE: {}, // Will be replaced with Redis in production
  LOGIN_ATTEMPTS: new Map(),
  LOCATION_CACHE: new Map(),
};