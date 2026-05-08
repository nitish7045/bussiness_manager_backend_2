// backend/services/locationService.js

const { LOCATION_CACHE } = require("../utils/constants");

async function getLocationFromIP(req) {
  try {

    // Get real client IP
    let ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      req.ip;

    // Clean IPv6 prefix
    if (ip && ip.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }

    // Handle localhost/development
    if (
      !ip ||
      ip === "::1" ||
      ip === "127.0.0.1" ||
      ip === "localhost"
    ) {
      return {
        city: "Local Development",
        region: "Local",
        country: "Local",
        isp: "Localhost",
        ip: ip || "127.0.0.1"
      };
    }

    // Check cache
    if (LOCATION_CACHE.has(ip)) {
      const cached = LOCATION_CACHE.get(ip);

      // Cache valid for 5 minutes
      if (Date.now() - cached.timestamp < 300000) {
        return cached.data;
      } else {
        LOCATION_CACHE.delete(ip);
      }
    }

    // Fetch location from IP API
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,city,regionName,isp,lat,lon,query`
    );

    const data = await response.json();

    let result;

    if (data.status === "success") {
      result = {
        city: data.city || "Unknown",
        region: data.regionName || "Unknown",
        country: data.country || "Unknown",
        isp: data.isp || "Unknown",
        lat: data.lat || null,
        lon: data.lon || null,
        ip: data.query || ip
      };
    } else {
      result = {
        city: "Unknown",
        region: "Unknown",
        country: "Unknown",
        isp: "Unknown",
        ip
      };
    }

    // Save to cache
    LOCATION_CACHE.set(ip, {
      data: result,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    console.error("Location Service Error:", error);

    return {
      city: "Unknown",
      region: "Unknown",
      country: "Unknown",
      isp: "Unknown"
    };
  }
}

module.exports = { getLocationFromIP };