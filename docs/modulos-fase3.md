# Fase 3: módulos base de negocio

## Objetivo

Dejar preparada la base para:

- clientes
- proveedores
- categorías
- productos
- almacenes
- inventario

## Reglas de negocio base

- El código de producto debe ser único.
- No se permite inventario negativo salvo configuración explícita.
- Los movimientos de inventario se deben registrar con usuario, almacén, motivo y documento.
- Los permisos deben validarse en backend.
- Las operaciones de negocio deberán registrarse con auditoría en fases posteriores.

## Endpoints base preparados

- GET /api/products
- POST /api/products
- GET /api/clients
- POST /api/clients
- GET /api/suppliers
- POST /api/suppliers
- GET /api/categories
- POST /api/categories
- GET /api/inventory
- POST /api/inventory/adjust
