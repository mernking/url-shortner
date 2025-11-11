FROM node:20-alpine

# Install necessary packages for Prisma
RUN apk add --no-cache libc6-compat openssl

# app dir
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies using pnpm (as specified in package.json)
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create directory for database
RUN mkdir -p prisma

ENV DATABASE_URL="file:./prisma/dev.db"
EXPOSE 4000

CMD ["pnpm", "start"]