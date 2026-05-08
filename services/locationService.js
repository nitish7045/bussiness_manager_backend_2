// backend/services/locationService.js

const { LOCATION_CACHE } = require("../utils/constants");

// Multiple IP geolocation services for fallback
const GEOLOCATION_SERVICES = [
  {
    name: 'ip-api',
    url: (ip) => `http://ip-api.com/json/${ip}?fields=status,country,city,regionName,isp,lat,lon,query`,
    parse: (data) => ({
      city: data.city || "Unknown",
      region: data.regionName || "Unknown",
      country: data.country || "Unknown",
      isp: data.isp || "Unknown",
      lat: data.lat,
      lon: data.lon,
      ip: data.query
    }),
    requiresKey: false
  },
  {
    name: 'ipapi',
    url: (ip) => `https://ipapi.co/${ip}/json/`,
    parse: (data) => ({
      city: data.city || "Unknown",
      region: data.region || "Unknown",
      country: data.country_name || "Unknown",
      isp: data.org || "Unknown",
      lat: data.latitude,
      lon: data.longitude,
      ip: data.ip
    }),
    requiresKey: false
  }
];

async function getLocationFromIP(req) {
  try {
    // Get real client IP - improved extraction
    let ip = getRealClientIP(req);
    
    console.log(`📍 Getting location for IP: ${ip}`);

    // Handle localhost/development
    if (isLocalIP(ip)) {
      return {
        city: "Local Development",
        region: "Local",
        country: "Local",
        isp: "Localhost",
        ip: ip || "127.0.0.1"
      };
    }

    // Check cache first
    const cachedData = getFromCache(ip);
    if (cachedData) {
      console.log(`📍 Using cached location for ${ip}: ${cachedData.city}`);
      return cachedData;
    }

    // Try multiple geolocation services
    let locationData = null;
    
    for (const service of GEOLOCATION_SERVICES) {
      try {
        console.log(`📍 Trying ${service.name} for ${ip}...`);
        locationData = await fetchLocation(service, ip);
        
        if (locationData && locationData.city !== "Unknown") {
          console.log(`✅ ${service.name} found: ${locationData.city}, ${locationData.country}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ ${service.name} failed:`, err.message);
      }
    }

    // If all services fail, return default with IP info
    if (!locationData || locationData.city === "Unknown") {
      console.log(`⚠️ Could not determine location for ${ip}`);
      locationData = {
        city: "Unknown",
        region: "Unknown",
        country: "Unknown",
        isp: "Unknown",
        ip: ip
      };
    }

    // Save to cache
    saveToCache(ip, locationData);

    return locationData;

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

// Helper function to get real client IP
function getRealClientIP(req) {
  // Get all possible IP headers
  const forwardedFor = req.headers["x-forwarded-for"];
  const realIP = req.headers["x-real-ip"];
  const cfConnectingIP = req.headers["cf-connecting-ip"]; // Cloudflare
  const trueClientIP = req.headers["true-client-ip"];
  
  let ip = null;
  
  // Priority order for accurate IP detection
  if (cfConnectingIP) {
    ip = cfConnectingIP;
  } else if (trueClientIP) {
    ip = trueClientIP;
  } else if (forwardedFor) {
    // Get the first IP in the chain (client IP)
    ip = forwardedFor.split(",")[0].trim();
  } else if (realIP) {
    ip = realIP;
  } else {
    ip = req.socket?.remoteAddress || req.ip;
  }
  
  // Clean IPv6 prefix
  if (ip && ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }
  
  // Remove port if present
  if (ip && ip.includes(":")) {
    ip = ip.split(":")[0];
  }
  
  console.log(`📡 Extracted IP: ${ip}`);
  return ip;
}

// Check if IP is local/development
function isLocalIP(ip) {
  if (!ip) return true;
  
  const localIPs = [
    "::1",
    "127.0.0.1",
    "localhost",
    "0.0.0.0"
  ];
  
  if (localIPs.includes(ip)) return true;
  
  // Check private IP ranges
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("172.")) {
    const parts = ip.split(".");
    if (parts.length >= 2) {
      const second = parseInt(parts[1]);
      if (second >= 16 && second <= 31) return true;
    }
  }
  
  return false;
}

// Fetch location from a service
async function fetchLocation(service, ip) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
  
  try {
    const response = await fetch(service.url(ip), {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === "fail" || data.error) {
      throw new Error("Service returned failure");
    }
    
    return service.parse(data);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Get from cache
function getFromCache(ip) {
  if (LOCATION_CACHE.has(ip)) {
    const cached = LOCATION_CACHE.get(ip);
    // Cache valid for 1 hour (increased from 5 minutes)
    if (Date.now() - cached.timestamp < 3600000) {
      return cached.data;
    } else {
      LOCATION_CACHE.delete(ip);
    }
  }
  return null;
}

// Save to cache
function saveToCache(ip, data) {
  LOCATION_CACHE.set(ip, {
    data: data,
    timestamp: Date.now()
  });
}

// Additional function to get location from coordinates (if needed)
async function getLocationFromCoords(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`
    );
    const data = await response.json();
    
    return {
      city: data.address?.city || data.address?.town || data.address?.village || "Unknown",
      region: data.address?.state || "Unknown",
      country: data.address?.country || "Unknown"
    };
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
}

module.exports = { getLocationFromIP, getLocationFromCoords };