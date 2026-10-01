# Frontend ERP

Frontend web React + Vite existente. Las pantallas se conservan; no se ha iniciado la migración a React Native.

`src/services/api.js` contiene el cliente común de API: URL base (`VITE_API_URL`), cabeceras/token, JSON y mensajes de error. Los catálogos/usuarios/roles consumen persistencia Mongo a través del backend; las vistas de módulos pendientes aún muestran las respuestas prototipo indicadas en el README raíz.

```powershell
npm ci
npm run dev
npm test
npm run build
```

## Despliegue en Cloudflare Workers Static Assets

El archivo `wrangler.jsonc` publica `dist/` como Static Assets y configura el fallback SPA para las rutas de React Router. Desde el directorio `frontend`, configura en Cloudflare Workers Builds:

- Root directory: `/frontend`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Build variable: `VITE_API_URL=https://proyecto-app-backend-k3tn.onrender.com`

Wrangler no ejecuta otro build: `wrangler.jsonc` no declara `build.command`, así que Cloudflare compila una vez y el deploy publica los archivos ya generados en `dist/`. Instala las dependencias con `npm ci`. El nombre configurado en `wrangler.jsonc` debe coincidir con el nombre del Worker de destino en Cloudflare.
