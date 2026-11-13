FROM node:22-alpine

WORKDIR /app

# Dependencias necesarias para Prisma y OpenSSL en Alpine
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

RUN npx prisma generate && npm run build

RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
