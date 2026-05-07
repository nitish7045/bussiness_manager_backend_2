// backend/services/deviceService.js
function getDeviceInfo(userAgent) {
  const deviceInfo = { browser: "Unknown", os: "Unknown", device: "Desktop" };
  if (!userAgent) return deviceInfo;

  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) deviceInfo.browser = "Chrome";
  else if (userAgent.includes("Firefox")) deviceInfo.browser = "Firefox";
  else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) deviceInfo.browser = "Safari";
  else if (userAgent.includes("Edg")) deviceInfo.browser = "Edge";
  else if (userAgent.includes("Opera")) deviceInfo.browser = "Opera";

  if (userAgent.includes("Windows")) deviceInfo.os = "Windows";
  else if (userAgent.includes("Mac")) deviceInfo.os = "macOS";
  else if (userAgent.includes("Linux")) deviceInfo.os = "Linux";
  else if (userAgent.includes("Android")) deviceInfo.os = "Android";
  else if (userAgent.includes("iOS") || userAgent.includes("iPhone") || userAgent.includes("iPad")) deviceInfo.os = "iOS";

  if (userAgent.includes("Mobile")) deviceInfo.device = "Mobile";
  else if (userAgent.includes("Tablet") || userAgent.includes("iPad")) deviceInfo.device = "Tablet";

  return deviceInfo;
}

module.exports = { getDeviceInfo };