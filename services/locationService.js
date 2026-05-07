// backend/services/locationService.js
const { LOCATION_CACHE } = require("../utils/constants");

async function getLocationFromIP(req) {
  try {
    let ip = req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip;

    if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
    if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();

    if (LOCATION_CACHE.has(ip)) {
      const cached = LOCATION_CACHE.get(ip);
      if (Date.now() - cached.timestamp < 300000) {
        return cached.data;
      } else {
        LOCATION_CACHE.delete(ip);
      }
    }

    const isLocalIP = ip === '::1' || ip === '127.0.0.1' || ip === 'localhost' ||
      ip === '0:0:0:0:0:0:0:1' || ip.startsWith('192.168.') || ip.startsWith('10.') ||
      (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31);

    let finalIp = ip;

    if (isLocalIP) {
      try {
        const publicIpResponse = await fetch('https://api.ipify.org?format=json');
        const publicIpData = await publicIpResponse.json();
        finalIp = publicIpData.ip;
      } catch (err) {
        return { city: 'Development', country: 'Local', region: 'Development', isp: 'Localhost' };
      }
    }

    const response = await fetch(`http://ip-api.com/json/${finalIp}?fields=status,country,city,regionName,isp,lat,lon,query`);
    const data = await response.json();

    let result = data.status === "success" ? {
      city: data.city || 'Unknown', region: data.regionName || 'Unknown',
      country: data.country || 'Unknown', isp: data.isp || 'Unknown',
      lat: data.lat, lon: data.lon, ip: data.query
    } : { city: 'Unknown', region: 'Unknown', country: 'Unknown', isp: 'Unknown', ip: finalIp };

    LOCATION_CACHE.set(ip, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    return { city: 'Unknown', country: 'Unknown', region: 'Unknown', isp: 'Unknown' };
  }
}

module.exports = { getLocationFromIP };