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

Los índices se crean automáticamente en desarrollo/pruebas. En producción se deshabilita `autoIndex`; `npm run db:indexes` crea los índices de los modelos sin borrar otros índices existentes.

## Transacciones

Altas y cambios de usuario, roles y catálogos incluyen su auditoría en la misma transacción para evitar cambios sin registro. Se necesita MongoDB con replica set. Las pruebas de integración usan un nombre de base aislado generado para cada ejecución y lo eliminan al cerrar.

## Migraciones pendientes

Los arrays exportados por `src/data/` permanecen en funciones heredadas prototipo: cotizaciones/devoluciones, notificaciones, ajustes e integraciones. Dashboard y reportes operativos agregan o consultan los modelos persistidos; `reportSeed` es un fixture sin endpoint productivo. La auditoría mostrada por `/api/reports/audit` lee la colección persistente `AuditLog`.
