# API REST

Prefijo: `/api`. Las respuestas de éxito usan `{ "success": true, "message": "...", "data": ... }`; los errores usan `{ "success": false, "message": "...", "error": "ERROR_CODE" }`. Los listados de catálogos conservan `data` como array e incluyen `pagination` con página, límite, total y páginas.

## Disponibilidad y autenticación

- `GET /api/health` — 200 cuando Mongo está conectado; 503 si no lo está.
- `POST /api/auth/login` — correo/contraseña y JWT.
- `GET /api/auth/me` — perfil actual.
- `PATCH /api/auth/password` — cambia la clave con la clave anterior.
- `POST /api/auth/logout` — informa cierre stateless; el cliente elimina el JWT.

Las demás rutas protegidas requieren `Authorization: Bearer <token>`. Los permisos se consultan desde el usuario/rol vigente en Mongo.

## Catálogos persistentes

Recursos: `/users`, `/roles`, `/categories`, `/products`, `/clients`, `/suppliers`, `/warehouses`.

Los catálogos ofrecen `GET`, `GET /:id`, `POST`, `PUT /:id` y `DELETE /:id` (baja lógica). Los listados aceptan `search`, `status`, `page`, `limit` (1–100), `sort` y `order=asc|desc`; productos también aceptan `categoryId`.

`GET /api/dashboard` requiere `dashboard.read` y calcula métricas persistidas con fechas diarias/mensuales en UTC; incluye ventas y movimientos financieros recientes y alertas de stock.

`GET /api/reports/data/:type` requiere `reports.read`. Tipos: `sales`, `purchases`, `inventory-stock`, `inventory-movements`, `receivables`, `payables`, `finance-movements`. Admite `from`, `to`, `status`, `customer`, `supplier`, `product`, `warehouse`, `movementType`, `lowStock=true`, `search`, `sortBy`, `sortOrder`, `page` y `limit` cuando aplican. Los filtros de cliente/proveedor/producto/almacén aceptan ObjectId o nombre; fechas de calendario (`YYYY-MM-DD`) se interpretan en UTC e incluyen el día final. La fecha de ventas/compras es la de creación; cuentas y movimientos usan su `createdAt`, y el inventario usa `updatedAt`. Responde con `data`, `pagination` y `totals` sobre el conjunto filtrado.

`GET /api/reports/data/:type/export.csv` exporta los mismos filtros, registra `report.exported` en auditoría y limita el archivo a 10,000 registros. CSV incluye cabeceras, escape de comillas y protección contra fórmulas de hoja de cálculo. `GET /api/reports/audit` consulta auditoría persistente, paginada y de solo lectura. Notificaciones y algunas rutas heredadas siguen siendo prototipos en memoria según el README.
