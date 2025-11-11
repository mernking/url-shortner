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