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

`GET /api/reports/audit` consulta auditoría persistente, paginada y de solo lectura. Los endpoints de otros módulos que aparecen en `GET /api` siguen siendo prototipos en memoria según el README.
