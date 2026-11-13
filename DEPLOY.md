# Guía de Demo y Despliegue — OptiLux PRO

Este proyecto usa **Next.js 15**, **Prisma + SQLite** y almacenamiento local de adjuntos (`/uploads`).
Por eso, **no se recomienda Vercel** (porque su sistema de archivos es efímero y borraría la base SQLite y las recetas adjuntas).

Tenés **2 formas rápidas** de mostrarle el sistema al cliente:

---

## Opción 1: Despliegue 24/7 en la nube (Recomendado — Railway)

Ya dejamos configurados `Dockerfile`, `docker-entrypoint.sh`, `.gitignore`, `.env.example` y `/api/health`. Al iniciar por primera vez, el contenedor crea las tablas y carga los datos demo automáticamente si la base está vacía.

### Paso 1: Subir el código a GitHub
En la terminal dentro de `c:\Users\Usuario\optica`:
```powershell
git init
git add .
git commit -m "Preparar OptiLux PRO para deploy"
```
Creá un repositorio privado en GitHub y subilo:
```powershell
git remote add origin https://github.com/TU_USUARIO/optilux-erp.git
git branch -M main
git push -u origin main
```

### Paso 2: Crear el proyecto en Railway
1. Entrá a [railway.app](https://railway.app) e iniciá sesión con GitHub.
2. Hacé clic en **New Project → Deploy from GitHub repo** y elegí `optilux-erp`.
3. Railway detectará automáticamente el `Dockerfile` y empezará a compilar.

### Paso 3: Agregar volumen persistente (muy importante)
1. En tu servicio dentro de Railway, abrí la pestaña **Volumes** (o clic derecho en el servicio → **Add Volume**).
2. Configurá el **Mount Path** en:
   ```
   /app/data
   ```

### Paso 4: Configurar variables de entorno
En la pestaña **Variables** del servicio, agregá:
- `DATABASE_URL` = `file:/app/data/optilux.db`
- `AUTH_SECRET` = *(cualquier texto largo y aleatorio, ej. generado con un password manager)*

### Paso 5: Generar URL pública
1. En la pestaña **Settings → Networking**, hacé clic en **Generate Domain**.
2. Railway te dará una URL HTTPS (ej: `https://optilux-erp-production.up.railway.app`).
3. ¡Listo! Compartile ese link al cliente.

---

## Opción 2: Demo instantánea desde tu PC (sin subir nada)

Si querés mostrarle el sistema **ahora mismo** en una llamada o mandarle un link temporal mientras tu PC está encendida:

1. Compilá e iniciá el servidor en modo producción:
   ```powershell
   npm.cmd run build
   npm.cmd run start
   ```
2. En otra terminal, descargá/ejecutá **Cloudflare Tunnel** (no requiere cuenta para pruebas rápidas):
   ```powershell
   winget install Cloudflare.cloudflared
   cloudflared tunnel --url http://localhost:3000
   ```
3. Te mostrará una URL `https://....trycloudflare.com` lista para abrir desde cualquier celular o computadora.

---

## Credenciales Demo para mostrar al cliente

En la pantalla `/login` el cliente puede elegir el perfil con un clic, o ingresar manualmente:

| Rol | Email | Contraseña | Qué mostrar |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@optilux.ar` | `optilux123` | Dashboard, POS, Caja, ABM Laboratorios, Stock y Cotización USD |
| **Vendedor / Asesor** | `ventas@optilux.ar` | `optilux123` | Ficha clínica Rx, Cotizador POS (tope 15% dto.), Entregas y Caja |
| **Técnico Lab** | `taller@optilux.ar` | `optilux123` | Tablero Kanban de órdenes, Recetas Rx y Stock (sin POS ni Caja) |

