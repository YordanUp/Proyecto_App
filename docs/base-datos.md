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
| AuditLog | módulo/fecha, usuario, registro y fecha indexados; sin rutas de borrado/edición |

Los índices se crean automáticamente en desarrollo/pruebas. En producción se deshabilita `autoIndex`; `npm run db:indexes` crea los índices de los modelos sin borrar otros índices existentes.

## Transacciones

Altas y cambios de usuario, roles y catálogos incluyen su auditoría en la misma transacción para evitar cambios sin registro. Se necesita MongoDB con replica set. Las pruebas de integración usan un nombre de base aislado generado para cada ejecución y lo eliminan al cerrar.

## Migraciones pendientes

Los arrays exportados por `src/data/` siguen siendo la fuente de estas pantallas prototipo: inventario/movimientos/almacenes legacy; ventas; compras; finanzas; dashboard; reportes/notificaciones/auditoría legacy; settings e integraciones. La auditoría mostrada por `/api/reports/audit` ya lee la colección persistente `AuditLog`; los otros arrays de `reports.js` no.
