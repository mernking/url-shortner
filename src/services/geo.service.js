const { LRUCache } = require("lru-cache");

const cache = new LRUCache({ max: 500, ttl: 1000 * 60 * 60 }); // 1 hour

const GEO_API = process.env.GEO_API_URL || "http://ip-api.com/json"; // ip-api.com/json/<ip>

async function lookup(ip) {
  if (!ip) return null;
  const cached = cache.get(ip);
  if (cached) return cached;

  try {
    const url = `${GEO_API}/${ip}`;
    const res = await fetch(url, { timeout: 3000 });
    if (!res.ok) return null;
    const data = await res.json();
    console.log("Geo data", data);
    if (data.status !== "success") return null;
    // normalize
    const out = {
      ip,
      country: data.country || null,
      region: data.regionName || data.region || null,
      city: data.city || null,
      lat: data.lat || null,
      lon: data.lon || null,
    };
    cache.set(ip, out);
    return out;
  } catch (e) {
    console.error("Geo lookup failed", e.message || e);
    return null;
  }
}

module.exports = { lookup };
