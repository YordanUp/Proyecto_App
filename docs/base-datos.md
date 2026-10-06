# Persistencia MongoDB

MongoDB Atlas es la persistencia operativa para usuarios, roles, categorías, productos, clientes, proveedores, almacenes y auditoría. El proyecto no selecciona Mongo local como fallback.

## Colecciones actuales

| Modelo | Índices y reglas |
| --- | --- |
| User | correo único normalizado; referencias a Role; estado; timestamps; hash excluido por defecto |
| Role | nombre único normalizado; permisos sin duplicados |
| Category | nombre único; estado y timestamps |
| Product | código único normalizado; nombre/búsqueda; categoría referenciada; precios validados |
| Client / Supplier | correo normalizado y único cuando se especifica; estado y timestamps |
| Warehouse | nombre único; estado y timestamps |
| InventoryStock | unicidad por producto/almacén; existencia, reservados y mínimo |
| InventoryMovement | producto/almacén/fecha, tipo/fecha, referencia; movimientos inmutables |
| Sale / Purchase | folio único, estado/fecha, cliente/proveedor; snapshots y timestamps |
| AccountsReceivable / AccountsPayable | folio y documento origen únicos; estado, cliente/proveedor y fecha |
| FinancialMovement | fecha, cuenta y referencia; movimientos financieros inmutables |
| AuditLog | módulo/fecha, usuario, registro y fecha indexados; sin rutas de borrado/edición |
| Integration | slug único; filtros por estado, tipo y habilitación; orden actualizado; timestamps |

Los índices se crean automáticamente en desarrollo/pruebas. En producción se deshabilita `autoIndex`; `npm run db:indexes` crea los índices de los modelos sin borrar otros índices existentes.

## Transacciones

Altas y cambios de usuario, roles y catálogos incluyen su auditoría en la misma transacción para evitar cambios sin registro. Se necesita MongoDB con replica set. Las pruebas de integración usan un nombre de base aislado generado para cada ejecución y lo eliminan al cerrar.

## Migraciones pendientes

Los arrays exportados por `src/data/` permanecen en funciones heredadas prototipo para módulos no migrados; solicitudes de devolución de ventas ya no usan fixtures en memoria. `SalesReturn` conserva artículos, montos, referencias y estado procesado inmutable en MongoDB, con índices únicos para folio y compuestos por venta/fecha y cliente/fecha. Ya no existe un seed de integraciones: su colección comienza vacía y no se cargan proveedores de muestra. El registro de integración solo acepta configuración no sensible y registra cambios en `AuditLog`. Dashboard y reportes operativos agregan o consultan modelos persistidos; `reportSeed` es un fixture sin endpoint productivo. La auditoría mostrada por `/api/reports/audit` lee la colección persistente `AuditLog`. `SystemSetting` contiene cuatro claves generales con índice único; `db:sync-settings` aplica defaults sin sobrescribir valores existentes.
