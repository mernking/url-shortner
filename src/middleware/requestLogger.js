const geoService = require('../services/geo.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getClientIp(req) {
  // X-Forwarded-For handling for proxies
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  // fallback
  return req.ip || req.connection?.remoteAddress || null;
}

async function requestLogger(req, res, next) {
  const ip = await getClientIp(req);
  const geo = await geoService.lookup(ip).catch(() => null);

  const log = {
    time: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    ip,
    geo,
    headers: {
      'user-agent': req.headers['user-agent'],
      referer: req.headers['referer'] || req.headers['referrer'],
    }
  };

  console.log(JSON.stringify(log));

  // Save to database
  const newLog = await prisma.requestLog.create({
    data: {
      method: log.method,
      path: log.path,
      ip: log.ip,
      country: log.geo?.country,
      region: log.geo?.region,
      city: log.geo?.city,
      latitude: log.geo?.lat,
      longitude: log.geo?.lon,
      headers: log.headers,
    },
  }).catch(err => console.error('Failed to save request log:', err));

  // Emit real-time update to connected admin clients
  if (newLog) {
    const io = req.app.get('io');
    if (io) {
      io.emit('new-request', {
        id: newLog.id,
        method: newLog.method,
        path: newLog.path,
        country: newLog.country,
        city: newLog.city,
        latitude: newLog.latitude,
        longitude: newLog.longitude,
        time: newLog.time
      });
    }
  }

  // attach to req for later usage (e.g., click recording)
  req._logger = log;
  next();
}

module.exports = requestLogger;