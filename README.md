# ERP Modular

ERP modular en evolución. Esta etapa convierte el núcleo de identidad, autorización, catálogos y auditoría a persistencia MongoDB. No implica que todos los módulos visibles en la interfaz ya sean persistentes.

## Estado real del repositorio

Persisten en MongoDB: usuarios, roles, categorías, productos, clientes, proveedores, almacenes y auditoría. La autenticación consulta el usuario activo y sus permisos actuales en cada petición protegida.

Siguen siendo prototipos en memoria: inventario y movimientos, ventas, compras, finanzas, dashboard, reportes, notificaciones, ajustes e integraciones. Sus pantallas/endpoints no deben usarse para operar datos reales. No se migraron ni eliminaron en esta etapa.

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

`.env.example` documenta `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN` y `CORS_ORIGIN`, además de las tres variables para crear la cuenta inicial. `JWT_SECRET` debe ser aleatorio y de al menos 32 caracteres. Nunca guardes `.env` o credenciales reales en Git.

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

La suite backend incluye pruebas de esquema/hash y una suite de integración que solo se ejecuta cuando `TEST_MONGODB_URI` apunta a una instancia de pruebas desechable compatible con transacciones. Aísla y elimina únicamente la base con nombre generado por la prueba. No uses una URI de producción. Sin esa variable, las pruebas de integración se reportan como omitidas, no aprobadas.

## Autenticación y API

- `POST /api/auth/login` entrega un JWT con sujeto, sin una copia de permisos.
- `GET /api/auth/me` y `/api/auth/profile` devuelven perfil y permisos actuales.
- `PATCH /api/auth/password` solicita contraseña actual y una nueva de 12–72 bytes.
- `POST /api/auth/logout` es stateless: el cliente elimina el JWT; su vencimiento limita la sesión.
- Las rutas protegidas consultan el usuario/rol en Mongo. Las respuestas siguen `{ success, message, data }` o `{ success, message, error }`.
- El catálogo ofrece búsqueda, filtros, orden, paginación (25 por omisión, hasta 100) y eliminación lógica.

## Limitaciones y siguiente etapa

Los antiguos tests de endpoints basados en usuarios y datos inventados se retiraron como evidencia de persistencia. Los archivos `backend/src/data/` siguen siendo usados por los módulos prototipo listados arriba y se migrarán por etapas. El siguiente trabajo recomendado es preparar inventario persistente y sus movimientos atómicos antes de habilitarlo para operaciones reales.
