# Arquitectura actual

## Capas implementadas

Para usuarios, roles, catálogos y auditoría, el backend sigue `Route → Controller → Service → Model → MongoDB`. Las rutas declaran endpoint y permiso; los controladores traducen HTTP; los servicios aplican validaciones y transacciones; Mongoose define persistencia, restricciones e índices.

La aplicación no escucha hasta conectar MongoDB. El proceso gestiona cierre ordenado, y Mongoose mantiene/reporta el estado de la conexión. El health check comprueba también la conexión a la base.

## Estado por dominios

Persistente: users, roles, categorías, productos, clientes, proveedores, almacenes y audit logs.

Prototipo con datos en memoria: inventario, ventas, compras, finanzas, dashboard, reportes, notificaciones, ajustes e integraciones. Sus services siguen leyendo `src/data/`; rutas existentes se conservan, pero no representan operaciones persistentes.

## Transacciones

Las mutaciones persistentes del núcleo y la auditoría correspondiente se ejecutan dentro de transacciones de MongoDB. Por ello el entorno debe soportar replica sets; MongoDB Atlas cumple este requisito. El inventario transaccional se desarrollará como etapa posterior.

## Frontend

React/Vite conserva sus pantallas actuales. `src/services/api.js` centraliza URL base, token, cabeceras, parseo JSON y errores HTTP. La migración a React Native/Web aún no se ha realizado.
