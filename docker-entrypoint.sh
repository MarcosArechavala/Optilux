#!/bin/sh
set -e

# Asegura que el directorio de datos persistente y uploads existan
mkdir -p /app/data/uploads

# Si /app/uploads no es un symlink al volumen persistente, enlazarlo
if [ ! -L /app/uploads ]; then
  rm -rf /app/uploads
  ln -s /app/data/uploads /app/uploads
fi

# Sincroniza el esquema Prisma con SQLite
npx prisma db push --skip-generate

# Si no hay usuarios en la base de datos, carga los datos demo automáticamente
USER_COUNT=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.user.count().then(c => { console.log(c); process.exit(0); }).catch(() => { console.log(0); process.exit(0); });
")

if [ "$USER_COUNT" = "0" ]; then
  echo "Base de datos vacía detectada. Sembrando datos demo de OptiLux PRO..."
  npx tsx prisma/seed.ts
fi

exec npm run start

