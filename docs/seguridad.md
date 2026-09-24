# Seguridad actual

- `MONGODB_URI` y `JWT_SECRET` son obligatorias para arrancar fuera de pruebas; no hay secreto productivo ni Mongo local predeterminados.
- El hash bcrypt se guarda en `passwordHash`, excluido de consultas y serialización por defecto.
- El JWT contiene solo el identificador de sujeto y vencimiento. Cada petición vuelve a comprobar que el usuario existe, está activo y conserva su rol.
- RBAC usa permisos granulares como `users.read`, `products.create` e `inventory.adjust`; el catálogo de permisos se valida en el backend.
- Errores de Mongo/Mongoose se convierten en respuestas comunes sin stack trace o detalle interno.
- CORS acepta la lista configurada en `CORS_ORIGIN`; configura el dominio real en despliegue.
- Rate limiting y Helmet se aplican en Express.
- Las altas, cambios y bajas lógicas del núcleo se auditan transaccionalmente. El endpoint de auditoría solo permite lectura; no hay borrado HTTP.

El logout es stateless: elimina el token en el cliente y la caducidad del JWT limita su duración. La invalidación inmediata ocurre cuando el usuario se desactiva o cambia su rol; no hay lista de revocación de tokens.

Pendiente antes de producción: configurar allowlist CORS exacta, gestionar los secretos en el proveedor de despliegue, aplicar índices de producción y revisar límites/telemetría para el entorno concreto.
