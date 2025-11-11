const prisma = require('../prisma/client');

async function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'API key required in x-api-key header' });

  const apiKey = await prisma.apiKey.findUnique({ where: { key }, include: { user: true }});
  if (!apiKey || !apiKey.isActive) return res.status(401).json({ error: 'Invalid API key' });

  req.apiKey = apiKey;
  next();
}

module.exports = apiKeyAuth;