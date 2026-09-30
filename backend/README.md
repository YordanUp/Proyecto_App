# Backend ERP

Express API con MongoDB mediante Mongoose. La aplicación conecta MongoDB antes de abrir el puerto HTTP; si falta `MONGODB_URI`, falla al iniciar. Desde la raíz copia `backend/.env.example` a `backend/.env`, completa sus valores y crea un usuario administrador de instalación con `npm run seed:admin`.

## Bootstrap de administrador en producción

El servidor solo intenta el bootstrap cuando `BOOTSTRAP_INITIAL_ADMIN` vale exactamente `true`. En Render, configura temporalmente esa variable y `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` en el servicio backend. La contraseña requiere al menos 12 caracteres y máximo 72 bytes UTF-8. El servidor conecta MongoDB primero y no abre el puerto si el bootstrap solicitado falla.

El proceso es idempotente: si ya hay una cuenta asignada al rol `admin`, no cambia el usuario, la contraseña ni el rol, y no necesita volver a recibir las variables `INITIAL_ADMIN_*`. Si no existe cuenta, crea (si hace falta) el rol de sistema con `PERMISSIONS`, crea un usuario activo con contraseña bcrypt y registra los eventos de bootstrap en auditoría. Un rol existente no se reescribe; si es inseguro o carece de permisos requeridos, el arranque falla con una indicación de revisión manual.

Después de comprobar que el inicio de sesión funciona, cambia `BOOTSTRAP_INITIAL_ADMIN` a `false` en Render y vuelve a desplegar. Luego puedes eliminar las variables `INITIAL_ADMIN_*`. No guardes sus valores en el repositorio, Blueprint ni registros. El comando manual `npm run seed:admin` comparte el mismo servicio idempotente.

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
