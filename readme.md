am using pnpm Nice—I’ll write a complete, developer-ready specification + code snippets (all 
  **JavaScript (CommonJS)** — no TypeScript) so Gemini can implement a self-hosted URL shortener API 
  with tracking, Prisma + SQLite, API key support, Docker, middleware logging (including geo lookup),
   and an auto-generated Swagger doc.

  I’ll include:

  * project structure
  * Prisma schema
  * important npm packages
  * Express routes (signup/login, API-key auth, short link creation, redirect & tracking, usage 
  endpoints)
  * middleware: request logger (console + geo lookup), API key auth, rate limiter
  * tracking model (clicks with headers, ua, referrer, country/city from IP)
  * alerts (excessive usage) design + sample implementation
  * swagger-jsdoc setup & auto-generation
  * Dockerfile + docker-compose
  * environment variables
  * setup / run instructions
  * sample curl calls

  # Summary / goals

  * API-only URL shortener for marketers/influencers.
  * Use Node.js (CommonJS) + Express.
  * Persistence: Prisma + SQLite.
  * Auth: signup/login (JWT) + API-key system for programmatic access.
  * Tracking: capture click events (timestamp, ip, geo, ua, referrer, device).
  * Logging: middleware logs every request to console plus geo lookup of IP (country/city).
  * Swagger UI auto-generated and served.
  * Docker-ready (Dockerfile + docker-compose for persistence).
  * Alerts: configurable threshold per API key (e.g., X clicks per minute/hour/day), sample 
  webhook/email alert implementation.
  * No TypeScript.

  ---

  # 1. Project structure

  ```
  api-meter/
  ├─ src/
  │  ├─ controllers/
  │  │  ├─ auth.controller.js
  │  │  ├─ links.controller.js
  │  │  ├─ track.controller.js
  │  ├─ middleware/
  │  │  ├─ requestLogger.js
  │  │  ├─ apiKeyAuth.js
  │  │  ├─ jwtAuth.js
  │  │  ├─ rateLimiter.js
  │  ├─ services/
  │  │  ├─ geo.service.js
  │  │  ├─ alert.service.js
  │  │  ├─ key.service.js
  │  ├─ prisma/
  │  │  └─ client.js
  │  ├─ swagger.js
  │  ├─ app.js
  │  └─ server.js
  ├─ prisma/
  │  └─ schema.prisma
  ├─ .env
  ├─ package.json
  ├─ Dockerfile
  ├─ docker-compose.yml
  └─ README.md
  ```

  ---

  # 2. Key npm packages to install

  ```bash
  npm init -y
  npm i express prisma @prisma/client bcrypt jsonwebtoken dotenv swagger-jsdoc swagger-ui-express 
  uuid nodemailer express-rate-limit node-fetch lru-cache
  # dev
  npm i -D prisma
  ```

  Notes:

  * `node-fetch` for external geolocation API calls.
  * `lru-cache` to cache geo lookups (avoid rate-limiting remote geo API).
  * `uuid` for API keys (or you can use secure-random hex).
  * `express-rate-limit` for rate-limiting endpoints.
  * `nodemailer` sample for alert emails (you can replace with webhook).

  ---

  # 3. Prisma schema (`prisma/schema.prisma`)

  ```prisma
  generator client {
    provider = "prisma-client-js"
  }

  datasource db {
    provider = "sqlite"
    url      = env("DATABASE_URL")
  }

  model User {
    id         Int       @id @default(autoincrement())
    email      String    @unique
    password   String
    name       String?
    createdAt  DateTime  @default(now())
    apiKeys    ApiKey[]
  }

  model ApiKey {
    id           Int      @id @default(autoincrement())
    key          String   @unique
    name         String?
    user         User     @relation(fields: [userId], references: [id])
    userId       Int
    createdAt    DateTime @default(now())
    isActive     Boolean  @default(true)
    dailyLimit   Int?     // optional usage limit to trigger alerts
    alerts       Alert[]
    links        Link[]
  }

  model Link {
    id         Int      @id @default(autoincrement())
    slug       String   @unique
    destination String
    title      String?
    createdBy  ApiKey   @relation(fields: [apiKeyId], references: [id])
    apiKeyId   Int
    createdAt  DateTime @default(now())
    clicks     Click[]
    meta       Json?
  }

  model Click {
    id         Int      @id @default(autoincrement())
    link       Link     @relation(fields: [linkId], references: [id])
    linkId     Int
    occurredAt DateTime @default(now())
    ip         String?
    country    String?
    region     String?
    city       String?
    ua         String?
    referrer   String?
    headers    Json?
  }

  model Alert {
    id        Int      @id @default(autoincrement())
    apiKey    ApiKey   @relation(fields: [apiKeyId], references: [id])
    apiKeyId  Int
    type      String
    message   String
    createdAt DateTime @default(now())
    resolved  Boolean  @default(false)
  }
  ```

  Environment example:

  ```
  DATABASE_URL="file:./dev.db"
  JWT_SECRET="supersecret_jwt_key"
  GEO_API_URL="http://ip-api.com/json"   # default geo IP API used
  ALERT_WEBHOOK_URL=""                   # optional
  ALERT_EMAIL_FROM=""
  ALERT_EMAIL_TO=""
  SMTP_HOST=""
  SMTP_PORT=""
  SMTP_USER=""
  SMTP_PASS=""
  PORT=4000
  ```

  ---

  # 4. Prisma client helper (`src/prisma/client.js`)

  ```js
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  module.exports = prisma;
  ```

  ---

  # 5. Geo service (caching + ip lookup) `src/services/geo.service.js`

  ```js
  const fetch = require('node-fetch');
  const LRU = require('lru-cache');

  const cache = new LRU({ max: 500, ttl: 1000 * 60 * 60 }); // 1 hour

  const GEO_API = process.env.GEO_API_URL || 'http://ip-api.com/json'; // ip-api.com/json/<ip>

  async function lookup(ip) {
    if (!ip) return null;
    const cached = cache.get(ip);
    if (cached) return cached;

    try {
      const url = `${GEO_API}/${ip}`;
      const res = await fetch(url, { timeout: 3000 });
      if (!res.ok) return null;
      const data = await res.json();
      const out = {
        ip,
        country: data.country || null,
        region: data.regionName || data.region || null,
        city: data.city || null,
      };
      cache.set(ip, out);
      return out;
    } catch (e) {
      console.error('Geo lookup failed', e.message || e);
      return null;
    }
  }

  module.exports = { lookup };
  ```

  Note: ip-api.com is used here as an example. Replace with any provider and ensure to follow rate 
  limits.

  ---

  # 6. Prisma-related commands

  After creating schema:

  ```bash
  npx prisma migrate dev --name init
  npx prisma generate
  ```

  ---

  # 7. Auth: signup/login controller (`src/controllers/auth.controller.js`)

  ```js
  const prisma = require('../prisma/client');
  const bcrypt = require('bcrypt');
  const jwt = require('jsonwebtoken');
  const { v4: uuidv4 } = require('uuid');

  const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
  const API_KEY_PREFIX = 'ak_';

  async function signup(req, res) {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const hashed = await bcrypt.hash(password, 10);
    try {
      const user = await prisma.user.create({
        data: { email, password: hashed, name },
      });
      return res.json({ id: user.id, email: user.email, name: user.name });
    } catch (err) {
      return res.status(400).json({ error: 'User creation failed', details: err.message });
    }
  }

  async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({ token });
  }

  // create API key for logged-in user
  async function createApiKey(req, res) {
    const { name, dailyLimit } = req.body;
    const userId = req.user.userId; // from jwtAuth middleware

    const key = API_KEY_PREFIX + uuidv4().replace(/-/g, '');
    const apiKey = await prisma.apiKey.create({
      data: {
        key,
        name,
        userId,
        dailyLimit: dailyLimit || null,
      },
    });

    return res.json({ apiKey: apiKey.key, id: apiKey.id, createdAt: apiKey.createdAt });
  }

  module.exports = { signup, login, createApiKey };
  ```

  ---

  # 8. JWT middleware `src/middleware/jwtAuth.js`

  ```js
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

  function jwtAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Missing authorization header' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Malformed 
  authorization header' });
    try {
      const payload = jwt.verify(parts[1], JWT_SECRET);
      req.user = payload;
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  module.exports = jwtAuth;
  ```

  ---

  # 9. API Key Auth middleware `src/middleware/apiKeyAuth.js`

  This will authenticate requests that use `x-api-key` header.

  ```js
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
  ```

  ---

  # 10. Request logger middleware (log every request to console + geo lookup) 
  `src/middleware/requestLogger.js`

  ```js
  const geoService = require('../services/geo.service');

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
    // attach to req for later usage (e.g., click recording)
    req._logger = log;
    next();
  }

  module.exports = requestLogger;
  ```

  This prints a compact JSON string to console for each request containing location info.

  ---

  # 11. Links controller `src/controllers/links.controller.js`

  ```js
  const prisma = require('../prisma/client');
  const { v4: uuidv4 } = require('uuid');

  // create short link (authenticated via API key)
  async function createLink(req, res) {
    const { destination, slug, title, meta } = req.body;
    if (!destination) return res.status(400).json({ error: 'destination is required' });

    // slug fallback
    const finalSlug = slug || uuidv4().slice(0, 8);

    try {
      const link = await prisma.link.create({
        data: {
          slug: finalSlug,
          destination,
          title,
          apiKeyId: req.apiKey.id,
          meta: meta || {},
        },
      });

      return res.json({ slug: link.slug, shortUrl: 
  `${req.protocol}://${req.get('host')}/${link.slug}`, id: link.id });
    } catch (err) {
      return res.status(400).json({ error: 'Link creation failed', details: err.message });
    }
  }

  async function getLinkStats(req, res) {
    const { slug } = req.params;
    const link = await prisma.link.findUnique({
      where: { slug },
      include: { clicks: { orderBy: { occurredAt: 'desc' } } }
    });
    if (!link) return res.status(404).json({ error: 'Not found' });
    return res.json({
      slug: link.slug,
      destination: link.destination,
      clicksCount: link.clicks.length,
      clicks: link.clicks.slice(0, 100) // limit
    });
  }

  module.exports = { createLink, getLinkStats };
  ```

  ---

  # 12. Redirect & track controller `src/controllers/track.controller.js`

  ```js
  const prisma = require('../prisma/client');

  async function redirectHandler(req, res) {
    const { slug } = req.params;
    const link = await prisma.link.findUnique({ where: { slug }, include: { createdBy: true } });
    if (!link) return res.status(404).send('Not found');

    const ip = req._logger?.ip || req.ip;
    const geo = req._logger?.geo || {};
    const ua = req.headers['user-agent'];
    const ref = req.headers.referer || req.headers.referrer || null;

    // create click record (fire-and-forget style)
    try {
      await prisma.click.create({
        data: {
          linkId: link.id,
          ip,
          country: geo?.country || null,
          region: geo?.region || null,
          city: geo?.city || null,
          ua,
          referrer: ref,
          headers: JSON.stringify({
            'accept-language': req.headers['accept-language'],
            'x-forwarded-for': req.headers['x-forwarded-for'],
          }),
        }
      });
    } catch (e) {
      console.error('Failed to record click', e.message || e);
    }

    // optionally update counters or fire alerts
    // redirect
    res.redirect(link.destination);
  }

  module.exports = { redirectHandler };
  ```

  Note: Consider adding `res.set('Cache-Control', 'no-cache, no-store, must-revalidate')` if tracking
   every hit is required.

  ---

  # 13. Rate limiter (optional) `src/middleware/rateLimiter.js`

  ```js
  const rateLimit = require('express-rate-limit');

  const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200, // default maximum requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: 'Too many requests' }),
  });

  module.exports = globalLimiter;
  ```

  You can create per-API-key rate limits by tracking counters in Redis or SQLite and enforcing.

  ---

  # 14. Alert service design (`src/services/alert.service.js`)

  Simple implementation to check daily counts and send an email or webhook when threshold is 
  exceeded.

  ```js
  const prisma = require('../prisma/client');
  const nodemailer = require('nodemailer');
  const fetch = require('node-fetch');

  async function createAlert(apiKeyId, type, message) {
    return prisma.alert.create({
      data: { apiKeyId, type, message },
    });
  }

  // send notification
  async function notifyAdmins(subject, body) {
    if (process.env.ALERT_WEBHOOK_URL) {
      try {
        await fetch(process.env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ subject, body })
        });
      } catch (e) { console.error('webhook notify failed', e.message); }
    }

    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });

      try {
        await transporter.sendMail({
          from: process.env.ALERT_EMAIL_FROM,
          to: process.env.ALERT_EMAIL_TO,
          subject,
          text: body,
        });
      } catch (e) { console.error('email notify failed', e.message); }
    }
  }

  module.exports = { createAlert, notifyAdmins };
  ```

  Where to call alert check: after recording a click, check count in last 24h for that apiKey; if 
  over `apiKey.dailyLimit`, create alert + notify. Example pseudo:

  ```js
  // after click creation
  if (apiKey.dailyLimit) {
    const since = new Date(Date.now() - 24*60*60*1000);
    const count = await prisma.click.count({
      where: { link: { apiKeyId: link.apiKeyId }, occurredAt: { gte: since } }
    });
    if (count > apiKey.dailyLimit) {
      await createAlert(link.apiKeyId, 'usage_limit', `Daily clicks ${count} exceeded 
  ${apiKey.dailyLimit}`);
      await notifyAdmins('Usage limit exceeded', `API key ${link.apiKeyId} exceeded daily limit: 
  ${count}`);
    }
  }
  ```

  ---

  # 15. Swagger auto-generation `src/swagger.js`

  ```js
  const swaggerJSDoc = require('swagger-jsdoc');
  const swaggerUi = require('swagger-ui-express');

  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'URL Shortener API',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
        }
      },
      security: [],
    },
    apis: ['./src/controllers/*.js'] // annotate controllers with JSDoc @swagger comments
  };

  const swaggerSpec = swaggerJSDoc(options);

  function setupSwagger(app) {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }

  module.exports = { setupSwagger, swaggerSpec };
  ```

  You should add JSDoc-style swagger comments above controllers to populate docs.

  Example JSDoc in `createLink`:
  /**

  * @swagger
  * /api/links:
  * post:
  * ```
    summary: Create a short link
    ```
  * ```
    security:
    ```
  * ```
      - apiKey: []
    ```
  * ```
    requestBody:
    ```
  * ```
      required: true
    ```
  * ```
      content:
    ```
  * ```
        application/json:
    ```
  * ```
          schema:
    ```
  * ```
            type: object
    ```
  * ```
            properties:
    ```
  * ```
              destination:
    ```
  * ```
                type: string
    ```
  * ```
              slug:
    ```
  * ```
                type: string
    ```
  * ```
    responses:
    ```
  * ```
      200:
    ```
  * ```
        description: link created
    ```

  */

  ---

  # 16. app.js (wiring)

  ```js
  const express = require('express');
  const bodyParser = require('body-parser');
  const requestLogger = require('./middleware/requestLogger');
  const rateLimiter = require('./middleware/rateLimiter');
  const jwtAuth = require('./middleware/jwtAuth');
  const apiKeyAuth = require('./middleware/apiKeyAuth');
  const authController = require('./controllers/auth.controller');
  const linksController = require('./controllers/links.controller');
  const trackController = require('./controllers/track.controller');
  const { setupSwagger } = require('./swagger');

  const app = express();
  app.use(bodyParser.json());
  app.use(requestLogger);
  app.use(rateLimiter);

  // public api
  app.post('/signup', authController.signup);
  app.post('/login', authController.login);

  // swagger docs
  setupSwagger(app);

  // API endpoints for authenticated users (JWT)
  app.post('/api/api-keys', jwtAuth, authController.createApiKey);

  // API-key protected endpoints (create link)
  app.post('/api/links', apiKeyAuth, linksController.createLink);
  app.get('/api/links/:slug/stats', apiKeyAuth, linksController.getLinkStats);

  // public redirect endpoint (tracks clicks)
  app.get('/:slug', trackController.redirectHandler);

  // health
  app.get('/health', (req,res)=>res.json({ok:true}));

  module.exports = app;
  ```

  ---

  # 17. server.js

  ```js
  require('dotenv').config();
  const app = require('./app');

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });
  ```

  ---

  # 18. Dockerfile

  ```dockerfile
  FROM node:20-alpine

  # app dir
  WORKDIR /usr/src/app

  COPY package*.json ./
  RUN npm ci --only=production

  COPY . .

  # ensure prisma client is generated
  RUN npx prisma generate

  ENV DATABASE_URL="file:./dev.db"
  EXPOSE 4000

  CMD ["node", "src/server.js"]
  ```

  Note: For local dev, build with dev dependencies to run migrations; or use docker-compose with a 
  service for migrations.

  ---

  # 19. docker-compose.yml (for persistence & running migrations on startup)

  ```yaml
  version: "3.8"
  services:
    app:
      build: .
      volumes:
        - ./:/usr/src/app
        - prisma_data:/usr/src/app/dev_db
      ports:
        - "4000:4000"
      environment:
        - DATABASE_URL=file:./dev.db
        - JWT_SECRET=${JWT_SECRET}
        - PORT=4000
      command: >
        sh -c "npx prisma migrate deploy || npx prisma migrate dev --name init --skip-seed;
               node src/server.js"
  volumes:
    prisma_data:
  ```

  ---

  # 20. README - quick run (dev)

  1. copy `.env` file and set values.
  2. install

  ```bash
  npm install
  ```

  3. run prisma migrations

  ```bash
  npx prisma migrate dev --name init
  npx prisma generate
  ```

  4. start server

  ```bash
  node src/server.js
  ```

  5. open Swagger: `http://localhost:4000/docs`

  For Docker:

  ```bash
  docker build -t shortner-api .
  docker run -p 4000:4000 --env-file .env shortner-api
  ```

  ---

  # 21. Example cURL flows

  Signup:

  ```bash
  curl -X POST http://localhost:4000/signup -H "Content-Type: application/json" -d 
  '{"email":"you@example.com","password":"pass123"}'
  ```

  Login:

  ```bash
  curl -X POST http://localhost:4000/login -H "Content-Type: application/json" -d 
  '{"email":"you@example.com","password":"pass123"}'
  # get JWT from response
  ```

  Create API key (with JWT):

  ```bash
  curl -X POST http://localhost:4000/api/api-keys -H "Content-Type: application/json" -H 
  "Authorization: Bearer <JWT>" -d '{"name":"marketing-key","dailyLimit":1000}'
  ```

  Create link (with x-api-key):

  ```bash
  curl -X POST http://localhost:4000/api/links -H "Content-Type: application/json" -H "x-api-key: 
  ak_..." -d '{"destination":"https://example.com/landing","slug":"promo1"}'
  ```

  Redirect (public):

  ```
  GET http://localhost:4000/promo1
  ```

  ---

  # 22. Security & production notes

  * Use HTTPS in production; behind a reverse proxy (nginx) that sets `x-forwarded-for`.
  * Store `JWT_SECRET` securely.
  * Rotate API keys and allow key revocation (`isActive=false`).
  * Use Postgres (or MySQL) in production for concurrency; SQLite is fine for early self-hosting but 
  has concurrency limits.
  * For high throughput tracking, consider batching click inserts or using a message queue 
  (RabbitMQ/Kafka) and writing clicks asynchronously to DB.
  * For geo lookups at scale: use a local geoip2 database (MaxMind) or a paid geolocation API with 
  caching.
  * Consider GDPR/privacy: optionally hash IPs or offer opt-out flags, and include terms for link 
  owners.
  * Logging sensitive data: avoid logging raw IPs to shared consoles if security/privacy required.

  ---

  # 23. Auto-generated Swagger: tips

  * Annotate each controller function with JSDoc @swagger blocks so swagger-jsdoc picks up routes, 
  schemas, and security.
  * Expose the `/docs` route but protect it if you don't want it public (e.g., via basic auth or env 
  flag).

  ---

  # 24. Extra features you might want (future)

  * Vanity/custom domains per account.
  * UTM parameter auto-append for campaign tracking.
  * Quick analytics endpoints (clicks per hour/day, country breakdown).
  * CSV export for clicks.
  * Webhooks for each new click (for real-time pipelines).
  * Link expiry / password-protected links.
  * QR code generation endpoint