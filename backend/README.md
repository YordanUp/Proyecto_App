# Backend ERP

Express API con MongoDB mediante Mongoose. La aplicación conecta MongoDB antes de abrir el puerto HTTP; si falta `MONGODB_URI`, falla al iniciar. Desde la raíz copia `backend/.env.example` a `backend/.env`, completa sus valores y crea un usuario administrador de instalación con `npm run seed:admin`.

## Comandos

```powershell
npm ci
npm run dev
npm test
```

## Capas

- `src/routes`: endpoints y middleware.
- `src/controllers`: HTTP y traducción de resultados.
- `src/services`: reglas de negocio, transacciones y auditoría.
- `src/models`: esquemas Mongoose e índices.
- `src/middleware`: autenticación, permisos y errores.
- `src/config`: configuración y ciclo de vida de MongoDB.

## Persistencia real

Usuarios, roles, catálogos y auditoría usan MongoDB. El resto de módulos visibles aún usa datos de `src/data/` y es demostrativo; consulta el README raíz antes de usarlo.

Las operaciones de usuario, rol y catálogo escriben el cambio y el evento de auditoría en una transacción. Se requiere MongoDB Atlas o MongoDB configurado como replica set.

En producción `autoIndex` está desactivado: después de revisar el entorno ejecuta `npm run db:indexes` para crear los índices declarados (no elimina índices existentes).

## API y seguridad

El JWT solo lleva `sub`; el middleware recarga el estado del usuario y los permisos efectivos de su rol. Las contraseñas se almacenan con bcrypt, nunca en texto plano. Los errores 5xx se sanitizan. `GET /api/health` indica disponibilidad conjunta de API y base.

Los catálogos permiten `search`, `status`, `page`, `limit` (máximo 100), `sort` y `order`. Las bajas son lógicas; la API no ofrece borrado físico de catálogos o eventos de auditoría.

## Pruebas

`npm test` ejecuta validaciones de modelos/hash. La suite `persistence.integration.test.js` requiere `TEST_MONGODB_URI` de una base desechable compatible con transacciones y borra solo la base aislada que crea.
