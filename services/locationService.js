// backend/services/locationService.js

const { LOCATION_CACHE } = require("../utils/constants");

// Use a more reliable free API
async function getLocationFromIP(req) {
  try {
    // Get real client IP
    let ip = getRealClientIP(req);
    
    console.log(`📍 Getting location for IP: ${ip}`);

    // Handle localhost/development
    if (isLocalIP(ip)) {
      return {
        city: "Development",
        region: "Local",
        country: "Local",
        isp: "Localhost",
        ip: ip || "127.0.0.1"
      };
    }

    // Check cache
    const cachedData = getFromCache(ip);
    if (cachedData) {
      console.log(`📍 Using cached location for ${ip}: ${cachedData.city}`);
      return cachedData;
    }

    // Try multiple services
    let locationData = await getLocationFromMultipleServices(ip);
    
    if (!locationData) {
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

// Get real client IP from various headers
function getRealClientIP(req) {
  const headers = [
    'cf-connecting-ip',      // Cloudflare
    'x-forwarded-for',       // Standard proxy header
    'x-real-ip',             // Nginx proxy header
    'true-client-ip',        // Custom header
    'x-client-ip',           // Another common header
    'x-cluster-client-ip',   // AWS header
    'forwarded-for',         // Forwarded header
    'forwarded',             // Forwarded header
  ];
  
  let ip = null;
  
  for (const header of headers) {
    const value = req.headers[header.toLowerCase()];
    if (value) {
      if (header === 'x-forwarded-for') {
        // Get first IP in the chain
        ip = value.split(',')[0].trim();
      } else {
        ip = value;
      }
      if (ip && ip !== 'unknown') break;
    }
  }
  
  if (!ip) {
    ip = req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip;
  }
  
  // Clean IPv6 prefix
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  // Remove port if present
  if (ip && ip.includes(':')) {
    ip = ip.split(':')[0];
  }
  
  console.log(`📡 Extracted IP: ${ip}`);
  return ip;
}

// Check if IP is local
function isLocalIP(ip) {
  if (!ip) return true;
  
  const localIPs = ['::1', '127.0.0.1', 'localhost', '0.0.0.0'];
  if (localIPs.includes(ip)) return true;
  
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
      const second = parseInt(parts[1]);
      if (second >= 16 && second <= 31) return true;
    }
  }
  
  return false;
}

// Try multiple geolocation services
async function getLocationFromMultipleServices(ip) {
  const services = [
    {
      name: 'ip-api',
      url: `http://ip-api.com/json/${ip}?fields=status,country,city,regionName,isp,lat,lon,query`,
      timeout: 3000,
      parse: (data) => {
        if (data.status === 'success') {
          return {
            city: data.city || "Unknown",
            region: data.regionName || "Unknown",
            country: data.country || "Unknown",
            isp: data.isp || "Unknown",
            lat: data.lat,
            lon: data.lon,
            ip: data.query
          };
        }
        return null;
      }
    },
    {
      name: 'ipwhois',
      url: `https://ipwhois.io/json/${ip}`,
      timeout: 3000,
      parse: (data) => {
        if (data && !data.error && data.success !== false) {
          return {
            city: data.city || "Unknown",
            region: data.region || data.state || "Unknown",
            country: data.country || "Unknown",
            isp: data.isp || data.connection?.isp || "Unknown",
            lat: data.latitude,
            lon: data.longitude,
            ip: data.ip
          };
        }
        return null;
      }
    },
    {
      name: 'ipinfo',
      url: `https://ipinfo.io/${ip}/json`,
      timeout: 3000,
      parse: (data) => {
        if (data && !data.error) {
          return {
            city: data.city || "Unknown",
            region: data.region || "Unknown",
            country: data.country || "Unknown",
            isp: data.org?.split(' ').slice(1).join(' ') || "Unknown",
            lat: data.loc?.split(',')[0],
            lon: data.loc?.split(',')[1],
            ip: data.ip
          };
        }
        return null;
      }
    }
  ];

  for (const service of services) {
    try {
      console.log(`📍 Trying ${service.name}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), service.timeout);
      
      const response = await fetch(service.url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const result = service.parse(data);
      
      if (result && result.city !== "Unknown") {
        console.log(`✅ ${service.name} found: ${result.city}, ${result.country}`);
        return result;
      }
    } catch (err) {
      console.log(`⚠️ ${service.name} failed:`, err.message);
    }
  }
  
  return null;
}

// Get from cache
function getFromCache(ip) {
  if (LOCATION_CACHE.has(ip)) {
    const cached = LOCATION_CACHE.get(ip);
    // Cache valid for 1 hour
    if (Date.now() - cached.timestamp < 3600000) {
      return cached.data;
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

module.exports = { getLocationFromIP };