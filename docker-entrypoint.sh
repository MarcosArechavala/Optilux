#!/bin/sh
set -e

echo "=== OptiLux PRO: Iniciando contenedor ==="

# Fallbacks seguros si no se configuraron las variables en Railway
export DATABASE_URL="${DATABASE_URL:-file:/app/data/optilux.db}"
export AUTH_SECRET="${AUTH_SECRET:-optilux-demo-fallback-secret-key-2026-hs256-secure}"
export PORT="${PORT:-3000}"
export HOSTNAME="0.0.0.0"

echo "Usando DATABASE_URL=$DATABASE_URL en puerto $PORT"

# Asegura que el directorio de datos persistente y uploads existan
mkdir -p /app/data/uploads

# Si /app/uploads no es un symlink al volumen persistente, enlazarlo
if [ ! -L /app/uploads ]; then
  rm -rf /app/uploads
  ln -s /app/data/uploads /app/uploads
fi

# Sincroniza el esquema Prisma con SQLite
echo "Sincronizando base de datos con Prisma..."
./node_modules/.bin/prisma db push --skip-generate

# Si no hay usuarios en la base de datos, carga los datos demo automáticamente
USER_COUNT=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.user.count().then(c => { console.log(c); process.exit(0); }).catch(() => { console.log(0); process.exit(0); });
")

if [ "$USER_COUNT" = "0" ]; then
  echo "Base de datos vacía detectada. Sembrando datos demo de OptiLux PRO..."
  ./node_modules/.bin/tsx prisma/seed.ts
fi

echo "Levantando Next.js en 0.0.0.0:$PORT..."
exec ./node_modules/.bin/next start -H 0.0.0.0 -p "$PORT"
