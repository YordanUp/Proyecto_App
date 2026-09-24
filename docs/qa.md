# QA y pruebas

## Estado comprobado antes de migrar

La suite anterior reportaba 38 pruebas backend y 16 frontend aprobadas. Las 38 del backend iniciaban sesión con cuentas hardcodeadas y mutaban arrays; no verificaban MongoDB. Se retiraron como evidencia de persistencia al reemplazar esas rutas.

## Suite actual

- `backend/tests/core.test.js`: validación de esquemas y hash bcrypt sin base de datos.
- `backend/tests/persistence.integration.test.js`: integración HTTP real con Mongo, RBAC, duplicados, validación de catálogo y auditoría. Requiere `TEST_MONGODB_URI` a una base desechable compatible con transacciones; si falta, Node la reporta como omitida.
- Frontend: Vitest cubre el flujo/ruteo existente; build con `npm run build`.

Comandos: `npm test` dentro de `backend/` y `npm test`/`npm run build` dentro de `frontend/`.

La fase solo se cierra después de ejecutar las suites disponibles y documentar si la integración Mongo fue ejecutada u omitida por falta de URI de pruebas.
