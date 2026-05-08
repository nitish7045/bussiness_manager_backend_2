// backend/services/locationService.js

const { LOCATION_CACHE } = require("../utils/constants");

async function getLocationFromIP(req) {
  try {
    let ip = getRealClientIP(req);
    
    console.log(`📍 Getting location for IP: ${ip}`);

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

    // Try multiple services for better accuracy
    let locationData = await getLocationFromMultipleServices(ip);
    
    if (!locationData) {
      locationData = {
        city: "Unknown",
        region: "Unknown",
        country: "Unknown",
        isp: "Unknown",
        ip: ip,
        isMobileNetwork: false,
        networkType: "Unknown"
      };
    }

    // Detect if it's a mobile network
    if (locationData.isp && (locationData.isp.toLowerCase().includes('jio') || 
        locationData.isp.toLowerCase().includes('airtel') ||
        locationData.isp.toLowerCase().includes('vodafone') ||
        locationData.isp.toLowerCase().includes('idea') ||
        locationData.isp.toLowerCase().includes('bsnl') ||
        locationData.isp.toLowerCase().includes('cellular') ||
        locationData.isp.toLowerCase().includes('mobile'))) {
      locationData.isMobileNetwork = true;
      locationData.networkType = "Mobile";
      locationData.note = "Mobile network - location may be approximate";
    }

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

function getRealClientIP(req) {
  const headers = [
    'cf-connecting-ip',
    'x-forwarded-for',
    'x-real-ip',
    'true-client-ip',
    'x-client-ip',
  ];
  
  let ip = null;
  
  for (const header of headers) {
    const value = req.headers[header.toLowerCase()];
    if (value) {
      if (header === 'x-forwarded-for') {
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
  
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  if (ip && ip.includes(':')) {
    ip = ip.split(':')[0];
  }
  
  console.log(`📡 Extracted IP: ${ip}`);
  return ip;
}

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

async function getLocationFromMultipleServices(ip) {
  const services = [
    {
      name: 'ip-api',
      url: `http://ip-api.com/json/${ip}?fields=status,country,city,regionName,isp,lat,lon,query,mobile,proxy`,
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
            ip: data.query,
            isMobile: data.mobile || false,
            isProxy: data.proxy || false
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
            ip: data.ip,
            isMobile: data.type === 'mobile' || false,
            isProxy: data.proxy || false
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
            ip: data.ip,
            isMobile: false,
            isProxy: data.privacy?.proxy || false
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

function getFromCache(ip) {
  if (LOCATION_CACHE.has(ip)) {
    const cached = LOCATION_CACHE.get(ip);
    if (Date.now() - cached.timestamp < 3600000) {
      return cached.data;
    }
  }
  return null;
}

function saveToCache(ip, data) {
  LOCATION_CACHE.set(ip, {
    data: data,
    timestamp: Date.now()
  });
}

module.exports = { getLocationFromIP };