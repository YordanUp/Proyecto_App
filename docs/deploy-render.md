# Preparación de lanzamiento: Render + MongoDB Atlas

**Estado al 29 de septiembre de 2026:** preparación local en `release/render-production`. No hay conector de Render/Atlas disponible en este entorno y no se realizó despliegue, conexión a Atlas ni prueba post-deploy. Las URLs abajo son los nombres propuestos por el Blueprint, no endpoints verificados.

## Auditoría del repositorio

| Elemento | Resultado observado |
|---|---|
| Raíz del frontend | `frontend/` |
| Build frontend | `npm ci && npm test && npm run build`; Vite genera `dist/` |
| Raíz del backend | `backend/` |
| Build backend | `npm ci && npm test` |
| Start backend | `npm start` → `node server.js` |
| Escucha | `process.env.PORT`, ligado explícitamente a `0.0.0.0` |
| Health check | `GET /api/health`; responde 200 solo si MongoDB está conectado y 503 cuando no lo está |
| API común frontend | `frontend/src/services/api.js`; adjunta token y centraliza JSON/errores |
| Variables Vite | procesadas al compilar; build de producción falla si no se define `VITE_API_URL` |
| React Router | fallback SPA `/*` → `/index.html` incluido en Blueprint |
| Lockfiles | existen `frontend/package-lock.json` y `backend/package-lock.json`; se usa `npm ci` |
| Paquete raíz | no existe un `package.json` en la raíz; cada servicio se instala desde su `rootDir` |
| Entorno local | `backend/.env` está ignorado por Git y no está versionado; no se inspecciona ni se copia a Render |

`PORT` lo proporciona Render al proceso web y por eso no se fija manualmente en el Blueprint. Para desarrollo local, `VITE_API_URL` puede seguir usando `http://localhost:4000`; ese fallback no se permite en compilaciones de producción sin la URL pública configurada.

## Servicios en `render.yaml`

Los nombres intencionales son:

- Static Site: `yordanup-erp-web` → URL propuesta `https://yordanup-erp-web.onrender.com`.
- Web Service: `yordanup-erp-api` → URL propuesta `https://yordanup-erp-api.onrender.com`.

Confirma disponibilidad de esos nombres en Render. Si la plataforma requiere otros, modifica a la vez `CORS_ORIGIN`, `VITE_API_URL` y `connect-src` en la cabecera CSP antes de crear los servicios. El static site compila y publica `dist`; Render reescribe rutas SPA. El backend configura `/api/health`. Los dos servicios tienen auto-deploy apagado: habilítalo después de confirmar que CI/build/tests funcionan y que se conoce el flujo de rollback. No se fija plan/precio porque debe elegirlo la persona propietaria de la cuenta; verifica disponibilidad, costos y suspensión por inactividad antes de lanzar.

El backend utiliza `npm start`, no `npm run dev`. Render exige que el web service escuche en el puerto asignado y en `0.0.0.0`; el servidor ahora lo hace explícitamente.

## Variables y secretos

El Blueprint coloca `NODE_ENV=production`, `JWT_EXPIRES_IN=1h`, genera `JWT_SECRET` desde Render y solicita `MONGODB_URI` como secreto. `CORS_ORIGIN` debe corresponder exactamente al origen del frontend, sin barra final. `VITE_API_URL` corresponde a la URL pública del backend y queda incorporada en el build del frontend; no debe contener secretos. Render inyecta `PORT` al web service.

No imprimir ni copiar valores de secretos a Git, README, capturas ni logs. No pasar `backend/.env` al servicio. `.env.example` contiene placeholders ficticios.

## MongoDB Atlas: preparación requerida

No se inspeccionó la cuenta ni el cluster. Antes de configurar la URI:

1. Confirmar cluster y nombre de base de datos destino.
2. Crear un usuario exclusivo de aplicación con rol `readWrite` solo en esa base; no usar owner/project owner de Atlas.
3. Copiar la URI de conexión de la aplicación directamente al campo secreto `MONGODB_URI` en Render y codificar los caracteres especiales del usuario/contraseña en la URI.
4. Añadir a Atlas Network Access las direcciones/rangos de salida **del Web Service backend y su región** que aparecen en Render → servicio → Connect → Outbound. El static site no origina conexión a MongoDB.
5. Si se necesita una IP única estable, Render ofrece dedicated outbound IPs con requisitos de plan/costo; confirmar con quien administra la cuenta antes de contratarlos. Evitar `0.0.0.0/0`. Si solo es posible una excepción temporal, documentarla, limitar el usuario de DB y fijar fecha de retiro.
6. Confirmar si Atlas tiene backups automáticos habilitados y cómo recuperar antes de cargar datos reales.

Las IPs de salida de Render dependen de región; no se inventan ni se agregan desde este repositorio. Copia en Atlas los rangos que Render muestre para el servicio real.

## Secuencia de puesta en marcha

1. Publicar la rama `release/render-production` a GitHub cuando se revise el diff y se autorice el acceso al remoto.
2. Preparar Atlas y su lista de acceso limitada antes de iniciar el backend.
3. Crear los servicios usando el Blueprint de la rama release y comprobar que Render detecta `rootDir`, comandos, rewrites, secretos y health check. Inspeccionar el plan/costos antes de confirmar.
4. Si Render no reconoce los nombres sugeridos, fijar los nombres/URLs asignados antes del deploy y sincronizar CORS + URL del frontend + CSP.
5. Proporcionar `MONGODB_URI` como secreto en Render. El JWT se genera automáticamente por el Blueprint; comprobar que sea distinto al secreto de test.
6. Desplegar backend primero. Revisar logs sin revelar secretos y probar `/api/health` hasta obtener 200 y `database: connected`. La aplicación aborta arranque si la conexión falla.
7. Compilar/publicar el frontend con el `VITE_API_URL` público. Abrir `/`, `/login`, `/products`, `/inventory`, `/sales`, `/purchases`, `/finance` y refrescar rutas directas.
8. Verificar login, `/api/auth/me`, JWT, 401 anónimo, 403 sin permiso, logout, CORS desde el origen real, dashboard y ausencia de llamadas a localhost.
9. Crear admin inicial de manera controlada con `npm run seed:admin` y variables `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` suministradas temporalmente y fuera de Git. El seed falla si ya existe esa cuenta. No ejecutar seeds automáticamente en cada deploy.
10. Habilitar auto-deploy solo tras revisar CI/checks, monitoreo de health check, logs, y procedimiento de rollback a deploy/commit anterior.

Las APIs de inventario, ventas, compras, finanzas, dashboard, reportes, notificaciones, ajustes e integraciones conservan áreas de prototipo en memoria. El despliegue de la web no las convierte en persistentes; verificar sus insignias Demo y no cargar información empresarial real allí.

## Verificaciones locales y estado remoto

La configuración ejecuta los tests existentes antes de compilar/desplegar. La suite backend contiene una integración Mongo condicional y puede reportarla omitida si no se proporciona URI de pruebas; los tests unitarios aprobados no sustituyen la validación Atlas. Para comprobar el build local del frontend, define temporalmente un `VITE_API_URL` no secreto. No se declara éxito de health/login hasta ejecutar pruebas HTTP contra las URLs reales.

Estado remoto no verificable desde este entorno:

- Render services/URLs/deploy history: no accesibles.
- MongoDB Atlas cluster, usuario, Database, Network Access, backups/conexión: no accesibles.
- Frontend, login, JWT, RBAC y CORS post-deploy: pendientes.

Referencias oficiales para configurar y validar en la cuenta:

- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render root directories for monorepos](https://render.com/docs/monorepo-support)
- [Render HTTP health checks](https://render.com/docs/health-checks)
- [Render static-site rewrites](https://render.com/docs/redirects-rewrites)
- [Render outbound IP addresses](https://render.com/docs/outbound-ip-addresses)
- [MongoDB Atlas IP access list](https://www.mongodb.com/docs/atlas/security/ip-access-list/)

## Revisión, rollback y seguridad

Antes de desplegar, revisar `.gitignore`, `git ls-files` y el historial de Git por secretos. Si un secreto real se hubiera expuesto, rotarlo en el proveedor además de retirarlo del código/historial. Para rollback, usar el deploy anterior disponible en Render y conservar su commit asociado; no revertir con reset destructivo ni hacer merge automático a `main`.

Helmet, rate limit, validaciones, JWT/RBAC y sanitización de errores 5xx existen en la API. Atlas, HTTPS externo, estado real del backup, alertas, accesos Render y ausencia de incidentes de secretos no se verificaron desde esta sesión. Los datos operativos de módulos todavía in-memory siguen siendo el riesgo funcional principal.
