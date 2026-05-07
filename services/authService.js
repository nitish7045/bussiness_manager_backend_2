// backend/services/authService.js
const { LOGIN_ATTEMPTS } = require("../utils/constants");

function updateLoginAttempts(email, isSuccess) {
  const now = Date.now();
  let data = LOGIN_ATTEMPTS.get(email);

  if (isSuccess) {
    LOGIN_ATTEMPTS.delete(email);
    return { count: 0, lockUntil: null };
  }

  if (!data || (data.lockUntil && now > data.lockUntil)) {
    data = { count: 1, lockUntil: null, lastAttempt: now, attempts: [now] };
  } else {
    data.count += 1;
    data.lastAttempt = now;
    data.attempts = data.attempts || [];
    data.attempts.push(now);
    if (data.attempts.length > 10) data.attempts = data.attempts.slice(-10);
    if (data.count >= 5 && !data.lockUntil) {
      data.lockUntil = now + 15 * 60 * 1000;
    }
  }

  LOGIN_ATTEMPTS.set(email, data);
  return { count: data.count, lockUntil: data.lockUntil };
}

function isNewLocation(user, req) {
  if (!user.loginHistory || user.loginHistory.length === 0) return true;
  
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'];
  const recentLogins = user.loginHistory.slice(-5);
  
  return !recentLogins.some(login => login.ip === ip || login.userAgent === userAgent);
}

module.exports = { updateLoginAttempts, isNewLocation };