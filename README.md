# URL Shortener API

This is an API-only URL shortener with tracking, Prisma + SQLite, API key support, Docker, middleware logging (including geo lookup), and an auto-generated Swagger doc.

## 1. Project structure

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

## 2. Key npm packages

- `express`
- `prisma`
- `@prisma/client`
- `bcrypt`
- `jsonwebtoken`
- `dotenv`
- `swagger-jsdoc`
- `swagger-ui-express`
- `uuid`
- `nodemailer`
- `express-rate-limit`
- `node-fetch`
- `lru-cache`

## 3. Prisma schema (`prisma/schema.prisma`)

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

## 4. Environment variables (`.env`)

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="supersecret_jwt_key"
GEO_API_URL="http://ip-api.com/json"
ALERT_WEBHOOK_URL=""
ALERT_EMAIL_FROM=""
ALERT_EMAIL_TO=""
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""
PORT=4000
```

## 5. Quick run (development)

1.  Copy `.env` file and set values.
2.  Install dependencies (already done if you followed the initial setup).

    ```bash
pnpm install
    ```

3.  Run Prisma migrations

    ```bash
pnpm exec prisma migrate dev --name init
pnpm exec prisma generate
    ```

4.  Start server

    ```bash
node src/server.js
    ```

5.  Open Swagger: `http://localhost:4000/docs`

## 6. Docker

To build and run with Docker:

```bash
docker build -t shortner-api .
docker run -p 4000:4000 --env-file .env shortner-api
```

Or using `docker-compose`:

```bash
docker-compose up --build
```

## 7. Example cURL flows

**Signup:**

```bash
curl -X POST http://localhost:4000/signup -H "Content-Type: application/json" -d '{"email":"you@example.com","password":"pass123"}'
```

**Login:**

```bash
curl -X POST http://localhost:4000/login -H "Content-Type: application/json" -d '{"email":"you@example.com","password":"pass123"}'
# get JWT from response
```

**Create API key (with JWT):**

```bash
curl -X POST http://localhost:4000/api/api-keys -H "Content-Type: application/json" -H "Authorization: Bearer <JWT>" -d '{"name":"marketing-key","dailyLimit":1000}'
```

**Create link (with x-api-key):**

```bash
curl -X POST http://localhost:4000/api/links -H "Content-Type: application/json" -H "x-api-key: ak_..." -d '{"destination":"https://example.com/landing","slug":"promo1"}'
```

**Redirect (public):**

```
GET http://localhost:4000/promo1
```
