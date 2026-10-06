# ERP Modular

ERP modular en evolución. El núcleo de identidad, autorización, catálogos, Inventario, Ventas, Compras y Finanzas persiste en MongoDB. No implica que todos los módulos visibles en la interfaz ya sean persistentes.

## Estado real del repositorio

Persisten en MongoDB: usuarios, roles, categorías, productos, clientes, proveedores, almacenes, existencias, movimientos de inventario, ventas, compras, cotizaciones, cuentas por cobrar/pagar, movimientos financieros, notificaciones y auditoría. La autenticación consulta el usuario activo y sus permisos actuales en cada petición protegida.

Siguen siendo prototipos en memoria: solicitudes de devolución, ajustes e integraciones. Dashboard y reportes consultan ventas, compras, existencias, cuentas y movimientos financieros persistidos; la exportación CSV registra un evento de auditoría. Las ventas y compras usan folios persistentes y sus transiciones actualizan inventario y crean sus cuentas financieras relacionadas dentro de la misma transacción. Los pagos persisten sus movimientos y auditoría. No se importan datos demo a producción.

## Tecnologías y estructura

- Backend: Node.js, Express y Mongoose (`backend/`).
- Base de datos: MongoDB Atlas; no hay fallback automático a Mongo local.
- Frontend: React, Vite y React Router (`frontend/`).
- Documentación del dominio y API: `docs/`.

Backend: `routes → controllers → services → models → MongoDB`. Las escrituras del núcleo y su evento de auditoría usan transacciones MongoDB. Configura Atlas con un replica set (Atlas lo proporciona por defecto).

## Requisitos e instalación

Usa una versión LTS reciente de Node.js y una instancia de MongoDB Atlas. En PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
cd backend
npm ci
npm run seed:admin
npm run dev
```

Antes de `seed:admin`, completa `.env` con un usuario de base de datos dedicado, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` y `INITIAL_ADMIN_PASSWORD` (mínimo 12 caracteres). El comando crea un rol y una cuenta inicial; no existe usuario de demostración ni contraseña fija.

En otra terminal:

```powershell
cd frontend
npm ci
npm run dev
```

La URL de API web se configura como `VITE_API_URL` en el entorno de Vite; por defecto es `http://localhost:4000`.

## Variables de entorno

`.env.example` documenta `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN` y `CORS_ORIGIN`, las variables para crear la cuenta inicial y la configuración opcional de Resend. `JWT_SECRET` debe ser aleatorio y de al menos 32 caracteres. Nunca guardes `.env` o credenciales reales en Git.

El backend falla al arrancar si falta `MONGODB_URI` o `JWT_SECRET`; no cambia silenciosamente a otra base. `GET /api/health` devuelve `503` si Mongo no está conectado.

En producción, crea los índices con `cd backend; npm run db:indexes` después de revisar el cluster destino.

## Pruebas

```powershell
cd backend
npm test
cd ../frontend
npm test
npm run build
```

La suite backend incluye pruebas de esquema/hash y suites de integración que solo se ejecutan cuando `TEST_MONGODB_URI` apunta a una instancia de pruebas desechable compatible con transacciones. Cada suite aísla y elimina únicamente una base con nombre generado por la prueba. No uses una URI de producción. Sin esa variable, las pruebas de integración se reportan como omitidas, no aprobadas.

## Autenticación y API

- `POST /api/auth/login` entrega un JWT con sujeto, sin una copia de permisos.
- `GET /api/auth/me` y `/api/auth/profile` devuelven perfil y permisos actuales.
- `PATCH /api/auth/password` solicita contraseña actual y una nueva de 12–72 bytes.
- `POST /api/auth/logout` es stateless: el cliente elimina el JWT; su vencimiento limita la sesión.
- `POST /api/auth/verify-email` confirma cuentas nuevas; `POST /api/auth/resend-verification` reenvía de forma genérica y limitada. Consulta `backend/README.md` para la configuración de Resend y compatibilidad de usuarios existentes.
- Notificaciones persistentes: `GET /api/notifications`, `GET /api/notifications/unread-count`, `GET /api/notifications/:id`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` y `POST /api/notifications` (permiso `notifications.create`). La bandeja se limita al usuario autenticado; eventos operativos se escriben en la misma transacción que el evento que los genera.
- Las rutas protegidas consultan el usuario/rol en Mongo. Las respuestas siguen `{ success, message, data }` o `{ success, message, error }`.
- El catálogo ofrece búsqueda, filtros, orden, paginación (25 por omisión, hasta 100) y eliminación lógica.

### Dashboard y reportes

- `GET /api/dashboard` agrega indicadores de ventas confirmadas por día/mes UTC, compras pendientes/recibidas, stock bajo/sin existencia, saldos CxC/CxP y listas recientes. Requiere `dashboard.read`.
- `GET /api/reports/data/:type` ofrece reportes `sales`, `purchases`, `inventory-stock`, `inventory-movements`, `receivables`, `payables` y `finance-movements`; admite filtros aplicables, búsqueda, orden y paginación (máximo 100 por página). La respuesta incluye cantidad de registros y totales; movimientos de inventario también incluye entradas/salidas y conteo de movimientos.
- `GET /api/reports/data/:type/export.csv` exporta el conjunto filtrado hasta 10,000 filas, escapa campos CSV y registra la exportación en la auditoría. Requiere `reports.read`.
- Los filtros de cliente/proveedor/producto/almacén aceptan ObjectId o nombre. Las fechas `from`/`to` aceptan `YYYY-MM-DD` (UTC) o ISO datetime.
- El listado/creación heredado de “reportes generados” en memoria fue retirado. `reportSeed` permanece como fixture sin uso productivo.

### Roles operativos

- `backend/src/services/permissions.js` es la fuente de permisos; la matriz exacta para ventas, compras, almacén, finanzas y supervisor está en [docs/roles-operativos.md](docs/roles-operativos.md).
- Ejecuta `cd backend; npm run db:seed-operational-roles -- --dry-run` para revisar y `--apply` para sincronizar roles base. El comando no cambia admin ni usuarios, aborta si hay colisiones con roles personalizados y registra los cambios en auditoría dentro de una transacción.
- Web oculta navegación y bloquea rutas sin el permiso de lectura correspondiente. El backend verifica cada petición. La pantalla de roles lista los permisos actuales del servidor.

## Limitaciones y siguiente etapa

Los tests de integración que requieren MongoDB se omiten explícitamente cuando falta `TEST_MONGODB_URI`; no cuentan como aprobados. `backend/src/data/` sigue en uso por módulos prototipo, pero Inventario, Ventas, Compras, Finanzas y Notificaciones ya no dependen de seeds en memoria. Finanzas no implementa contabilidad fiscal, conciliación bancaria ni reembolsos. Las notificaciones actuales son eventos internos persistidos; no envían push ni correo.
