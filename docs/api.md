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

`GET /api/reports/data/:type/export.csv` exporta los mismos filtros, registra `report.exported` en auditoría y limita el archivo a 10,000 registros. CSV incluye cabeceras, escape de comillas y protección contra fórmulas de hoja de cálculo. `GET /api/reports/audit` consulta auditoría persistente, paginada y de solo lectura. Configuración ofrece `GET /api/settings` (permiso `settings.read`) y `PUT /api/settings/:key` (permiso `settings.update`), limitado a cuatro preferencias generales; cambios quedan auditados. Notificaciones son persistentes.

## Devoluciones de ventas

- `GET /api/sales/returns` — requiere `sales.returns.read`; acepta `search`, `saleId`, `customerId`, `from`, `to`, `page`, `limit`, `sort` y `order`.
- `GET /api/sales/returns/:id` — detalle; requiere `sales.returns.read`.
- `POST /api/sales/returns` — requiere `sales.returns.create`; recibe `saleId`, `reason`, `notes` opcionales e `items` con `productId`, `warehouseId`, `quantity` y `saleLineIndex` opcional cuando se repite producto/almacén en la venta.

Solo acepta ventas confirmadas. El backend calcula precio/impuestos desde la venta, verifica la cantidad acumulada y procesa documento, stock, CxC, auditoría y notificaciones en una transacción. No ofrece cancelación, reembolso externo ni nota fiscal. Si los pagos ya superan el nuevo total neto, responde `409 RETURN_REQUIRES_REFUND_REVIEW` sin guardar cambios.

## Integraciones persistentes

`/api/integrations` requiere `integrations.read` para listar/detallar, `integrations.create` para crear y `integrations.update` para editar/habilitar/deshabilitar. El listado acepta `search`, `type`, `status`, `enabled=true|false`, `page` y `limit` (máximo 100) y devuelve `data` más `pagination`. Las rutas son `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `POST /:id/enable` y `POST /:id/disable`. Crear recibe `name`, `type`, y opcionalmente `slug`, `description`, `owner`, `config`; `slug` se normaliza desde `name` cuando se omite. Editar admite únicamente `name`, `description`, `type`, `owner` y `config`; el slug es inmutable. Nuevas integraciones empiezan `pending`, deshabilitadas y sin fecha/error de sincronización. Deshabilitar fija `status=disconnected`; habilitar desde ese estado lo devuelve a `pending`. No hay sincronización ni conexión con servicios externos.
