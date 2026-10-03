# Roles operativos

La lista exportada por `backend/src/services/permissions.js` es la fuente de verdad de permisos. La matriz operativa se define en `backend/src/services/operationalRoles.js`; el seed valida que cada permiso solicitado pertenezca a esa lista antes de leer o escribir roles.

| Rol | Permisos |
| --- | --- |
| `admin` | Todos los permisos actuales de `PERMISSIONS`. El seed verifica que esté completo y no lo modifica. |
| `ventas` | `dashboard.read`, `products.read`, `categories.read`, `clients.read`, `clients.create`, `clients.update`, `inventory.read`, `sales.read`, `sales.create`, `sales.update`, `sales.cancel`, `reports.read`. |
| `compras` | `dashboard.read`, `products.read`, `categories.read`, `suppliers.read`, `suppliers.create`, `suppliers.update`, `warehouses.read`, `inventory.read`, `purchases.read`, `purchases.create`, `purchases.update`, `purchases.approve`, `purchases.receive`, `purchases.cancel`, `reports.read`. |
| `almacen` | `dashboard.read`, `products.read`, `categories.read`, `warehouses.read`, `inventory.read`, `inventory.create`, `inventory.adjust`, `reports.read`. |
| `finanzas` | `dashboard.read`, `clients.read`, `suppliers.read`, `sales.read`, `purchases.read`, `finance.read`, `finance.create`, `finance.approve`, `finance.receive_payment`, `finance.make_payment`, `reports.read`. |
| `supervisor` | `dashboard.read`, `products.read`, `categories.read`, `clients.read`, `suppliers.read`, `warehouses.read`, `inventory.read`, `sales.read`, `purchases.read`, `finance.read`, `reports.read`. |

## Sincronizar roles base

El comando exige exactamente uno de estos modos y conecta con el `MONGODB_URI` configurado en Backend:

```powershell
cd backend
npm run db:seed-operational-roles -- --dry-run
npm run db:seed-operational-roles -- --apply
```

`--dry-run` solo reporta las altas/cambios. `--apply` aplica todo en una transacción, registra auditoría y puede repetirse de forma idempotente. Actualiza o crea solo roles base marcados como `isSystem`; nunca borra roles. Si encuentra un rol personalizado con el mismo nombre, un `admin` ausente/ambiguo/incompleto, o permisos fuera de `PERMISSIONS`, aborta sin escribir. La sincronización del admin, si se requiere, es una migración separada (`db:sync-admin-permissions`). No cambia asignaciones de usuarios.

Los roles `isSystem` no se pueden editar desde la API normal de roles. La pantalla Web muestra los permisos devueltos por el backend agrupados por módulo. La asignación desde Usuarios requiere `users.update`, `users.assign_role` y `roles.read`; la creación requiere `users.create`, `users.assign_role` y `roles.read`.

La navegación y las rutas Web se ocultan/restringen usando `permissions` entregados en el perfil de sesión. Las rutas del backend siguen validando permisos en cada solicitud y son la autoridad.

## Mobile

El código Mobile de `feature/mobile-operational` filtra tabs/módulos usando permisos recibidos del perfil autenticado. No se incorporó a esta rama: `main` no incluye los archivos fuente de Mobile y no se debe añadir el proyecto entero como parte de esta fase Web/Backend. Debe validarse e integrarse por separado antes de declarar paridad Mobile para esta matriz.
