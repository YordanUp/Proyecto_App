# Catálogos base y límites de fase

Persisten en MongoDB categorías, productos, clientes, proveedores y almacenes. Las rutas permiten leer, crear, actualizar y desactivar lógicamente. Hay índices de unicidad/búsqueda, validaciones de campos y reglas de precios, filtros, búsqueda, orden y paginación.

Las escrituras se registran en auditoría dentro de la misma transacción. Los permisos granulares se validan en el backend.

El inventario real no se ha construido. `GET /api/inventory`, sus movimientos y su almacén legacy siguen conectados a datos de demostración; usa `/api/warehouses` para el catálogo persistente de almacenes. Los arrays del inventario deben migrarse al implementar el primer módulo empresarial.
