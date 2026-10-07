# Arquitectura actual

## Capas implementadas

Para usuarios, roles, catálogos y auditoría, el backend sigue `Route → Controller → Service → Model → MongoDB`. Las rutas declaran endpoint y permiso; los controladores traducen HTTP; los servicios aplican validaciones y transacciones; Mongoose define persistencia, restricciones e índices.

La aplicación no escucha hasta conectar MongoDB. El proceso gestiona cierre ordenado, y Mongoose mantiene/reporta el estado de la conexión. El health check comprueba también la conexión a la base.

## Estado por dominios

Persistente: users, roles, categorías, productos, clientes, proveedores, almacenes, existencias, movimientos de inventario, ventas, devoluciones de ventas, compras, finanzas, dashboard agregado, reportes, integraciones internas, notificaciones, configuración y audit logs.

Las devoluciones de ventas persisten como documentos inmutables y transaccionales en MongoDB; compras aún no tiene flujo de devoluciones. Integraciones es un registro administrativo persistente, sin conectores ni sincronización externa. Cotizaciones, notificaciones y preferencias generales de configuración también persisten en MongoDB. El registro de reportes simulado fue retirado de la API; el fixture que queda en `src/data/reports.js` no se usa para reportes operativos. Las consultas Mongo están descritas en `docs/api.md`.

## Transacciones

Las mutaciones persistentes del núcleo y la auditoría correspondiente se ejecutan dentro de transacciones de MongoDB. Por ello el entorno debe soportar replica sets; MongoDB Atlas cumple este requisito. Inventario, ventas, compras y devoluciones aplican escrituras coordinadas con movimientos y auditoría en transacciones.

## Métricas de ventas

Dashboard y reportes distinguen importes brutos de ventas confirmadas, devoluciones procesadas y neto. Tanto Dashboard como reporte `sales` asignan el periodo financiero de la venta a `confirmedAt`; `createdAt` solo conserva su uso como fecha de creación visible. En ambos, las devoluciones se asignan a `processedAt`, por lo que una devolución del período puede corresponder a una venta confirmada antes. Los aliases de dashboard `salesToday` y `salesMonth` se mantienen deprecados y siguen expresando bruto. Los saldos CxC/CxP no se calculan desde el neto comercial.

## Frontend

React/Vite conserva sus pantallas actuales. `src/services/api.js` centraliza URL base, token, cabeceras, parseo JSON y errores HTTP. La migración a React Native/Web aún no se ha realizado.
