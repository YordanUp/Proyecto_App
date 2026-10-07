# Auditoría técnica del ERP YordanUp

> **Actualización — 6 de octubre de 2026:** el dictamen y las tablas debajo de esta nota son el snapshot histórico del 28 de septiembre; varias conclusiones ya no describen el código actual. Los dominios operativos enumerados en el historial ya se migraron a persistencia. La fase vigente añade consistencia de ventas brutas/devoluciones/netas en Dashboard, reporte de ventas, CSV y Mobile Dashboard, además del reporte paginado de devoluciones. No cambia `Sale.total`, pagos/CxC, creación de devoluciones ni lógica fiscal. Su validación de integración MongoDB depende de `TEST_MONGODB_URI` disponible y conectividad al cluster desechable. Devolución de compras, reembolsos externos y notas fiscales siguen fuera de alcance.

## Estado de la fase — consistencia financiera y reportes

- Dashboard Web/Mobile presenta bruto confirmado, devoluciones procesadas y neto por día y mes UTC; aliases `salesToday`/`salesMonth` quedan temporalmente como bruto.
- Reporte de ventas emite valores explícitos `gross*`, `returned*` y `net*`; devoluciones se cuentan por fecha de procesamiento, incluso si la venta es anterior al periodo. La búsqueda/lista de devoluciones usa filtros por fechas, cliente, venta y texto, con límite de página 100.
- CSV identifica subtotal/impuestos/total brutos, devueltos y netos. `SALE_RETURN` se clasifica como entrada en reportes de inventario; `RETURN` continúa vigente para movimientos legados.
- Neto comercial no equivale a saldo CxC; los pagos no cambian `Sale.total` ni se usan para calcular venta neta.
- Índices de `SalesReturn` incluyen estado/fecha procesada y venta/estado; no se cambia la creación ni la lógica financiera de devoluciones.
- **Validación ejecutada:** primera suite backend completa: 61/71 aprobadas; 9 integraciones agotaron la conexión con `querySrv ETIMEOUT` al resolver MongoDB Atlas desde `TEST_MONGODB_URI` (base configurada `erp_test`) y una aserción unitaria del límite CSV quedó obsoleta. Corregida esa aserción; las 8 pruebas unitarias de analítica pasan aisladas. No se pudo repetir la suite completa tras el ajuste porque la misma restricción de DNS persiste. Frontend: 103/103 y build aprobado. Mobile: 49/49, lint y typecheck aprobados. `git diff --check` aprobado.
- **Estado:** implementación y validaciones locales listas para revisión; validación Mongo persistida bloqueada por DNS/red del entorno. No declarar `NET SALES REPORTING READY FOR MANUAL VALIDATION` hasta repetir backend completo con conectividad a la base desechable y validar el caso operativo en Web/Mobile.

## Estado vigente de la fase de devoluciones

- Backend: `SalesReturn`, folio anual, índices, listado/detalle/creación, RBAC explícito, auditoría, notificaciones, reposición `SALE_RETURN` y ajuste transaccional de CxC.
- Concurrencia: dos solicitudes concurrentes compiten sobre una revisión interna de la venta; la segunda recalcula las cantidades procesadas. Totales, estado y snapshots históricos de `Sale` no cambian.
- Riesgos financieros: si pagos recibidos exceden la venta neta, se rechaza con `409 RETURN_REQUIRES_REFUND_REVIEW`; una venta con devoluciones procesadas no permite la cancelación total que repondría el stock otra vez.
- Clientes: Web y Mobile permiten consultar y crear devoluciones, muestran el detalle y la disponibilidad por línea. Los permisos backend siguen siendo autoridad.
- Decisión: devoluciones procesadas son inmutables. No se expone cancelación, reembolso bancario ni nota fiscal.
- Verificación de esta fase: backend `npm.cmd test -- --test-concurrency=1`, frontend `npm.cmd test`/`npm.cmd run build`, Mobile `npm.cmd test`/`npm.cmd run lint`/`npm.cmd run typecheck` y `git diff --check`.
- Migración RBAC: aplicar en el entorno objetivo `db:sync-admin-permissions` y después `db:seed-operational-roles`, primero con `--dry-run`; los permisos nuevos no se agregan directamente a usuarios.

**Fecha:** 28 de septiembre de 2026  
**Alcance:** inspección estática de repositorio, configuración, rutas, controladores, servicios, modelos, pruebas, documentación y frontend. No se conectó a MongoDB Atlas ni se ejecutó una prueba de integración contra una base real.

**Verificación previa:** backend 5 aprobadas y 1 integración omitida; frontend 16 aprobadas; build de producción aprobado. Esta auditoría se complementó después con la normalización visual de todas las rutas web.

## Dictamen ejecutivo

El repositorio ya tiene una base persistente para identidad y catálogos, con MongoDB/Mongoose, autenticación JWT, autorización por permisos y bitácora de auditoría. También existe una capa compartida de API en el frontend. Esto es un núcleo funcional de aplicación, pero **todavía no es un ERP apto para registrar operación empresarial real**: inventario, ventas, compras, finanzas y varios paneles siguen consumiendo datos de muestra en memoria.

La conexión está configurada para fallar si no hay `MONGODB_URI` fuera de pruebas. El proceso de servidor conecta antes de escuchar y el health check de API contempla el estado de la base. La integración HTTP contra Mongo está preparada, pero sin `TEST_MONGODB_URI` se omite; por tanto, la persistencia y las transacciones no quedan verificadas en este entorno.

**Estado global: núcleo parcialmente maduro; no declarar listo para producción ni para operar inventario/ventas.** La implementación cumple buena parte de la arquitectura solicitada para los dominios persistentes. La siguiente fase recomendada es cerrar la verificación de Mongo y después construir inventario persistente como primer módulo empresarial.

## Evidencia por área

| Área | Estado observado | Evidencia |
|---|---|---|
| Conexión MongoDB | Configuración obligatoria, sin fallback local silencioso; timeout de selección y conexión previa al servidor | `backend/src/config/config.js`, `backend/src/config/database.js`, `backend/server.js` |
| Health check | `GET /api/health` informa disponibilidad de base | `backend/src/routes/index.js` |
| Identidad y acceso | User/Role persistidos; JWT verificado y el rol/permisos actuales se consultan desde Mongo en cada petición | `backend/src/models/User.js`, `backend/src/models/Role.js`, `backend/src/middleware/auth.js` |
| Catálogos | Categorías, productos, clientes, proveedores y almacenes pasan por servicios y modelos; soportan paginación y validaciones | `backend/src/services/catalogService.js`, `backend/src/models/catalog.js` |
| Auditoría | Los cambios del núcleo y rechazos de autorización se registran; endpoint de consulta protegido | `backend/src/services/auditService.js`, `backend/src/routes/` |
| Transacciones | Mutaciones del núcleo agrupan registro y auditoría con sesión Mongo | `backend/src/services/catalogService.js`, `backend/src/services/userService.js`, `backend/src/services/roleService.js` |
| Datos de muestra | Los servicios de inventario, ventas, compras, finanzas, dashboard, reportes, notificaciones, ajustes e integraciones leen `backend/src/data/` | `backend/src/services/*Service.js`, `backend/src/data/` |
| Frontend | `services/api.js` centraliza solicitudes; las pantallas operativas heredadas siguen siendo heterogéneas y no equivalen a persistencia | `frontend/src/services/api.js`, `frontend/src/screens/` |
| Seguridad de sesión | JWT se guarda en `localStorage`; logout elimina el token del cliente, mientras el endpoint server-side es stateless | `frontend/src/App.jsx`, `backend/src/controllers/authController.js` |
| Pruebas | Hay pruebas de esquema/hash y una suite Supertest real condicional; esta última necesita replica set/base desechable | `backend/tests/core.test.js`, `backend/tests/persistence.integration.test.js`, `docs/qa.md` |

## Hallazgos priorizados

### Alto — la operación principal aún es simulada

Inventario, ventas, compras, finanzas y dashboard/reportes ya consumen datos persistentes. Devoluciones de ventas también persisten ahora con una operación transaccional; los ajustes que aún dependan de datos demo deben identificarse de forma puntual por módulo. Este documento conserva una auditoría histórica anterior y requiere actualización integral en una revisión dedicada.

### Alto — falta evidencia de integración real con MongoDB

La suite HTTP de persistencia está condicionada por `TEST_MONGODB_URI`; sin ella se omite, y ninguna prueba unitaria puede demostrar que índices, transacciones, permisos y persistencia sobreviven a una operación real. Ejecutar esta suite contra una base de pruebas Atlas aislada antes de dar por cerrada la fase de núcleo. No usar URI de producción.

### Medio — gestión de sesiones stateless

El cierre de sesión borra el token del navegador, pero no lo revoca en servidor. Desactivar usuario o cambiar permisos afecta nuevas peticiones porque el middleware vuelve a consultar User/Role; un JWT robado sigue vigente hasta expirar. El almacenamiento en `localStorage` también aumenta la exposición ante XSS. Revisar política de expiración y almacenamiento antes de un despliegue con datos sensibles.

### Medio — controles de autorización en navegación

La API es quien aplica autorización, lo cual es el control de seguridad efectivo. La navegación compartida actual presenta rutas a usuarios autenticados sin filtrar cada enlace por permiso. Esto no concede acceso (la API debe responder 403), pero puede producir enlaces y pantallas con errores para roles restringidos. Conviene hacer navegación consciente de permisos como mejora de experiencia, manteniendo el control en backend.

### Medio — interfaz heredada y representatividad

El estilo común nuevo reproduce la estructura visual de referencia (menú lateral oscuro, barra superior clara, tarjetas, acentos verdes y rail lateral) y usa la segunda imagen como logo suministrado. Los valores del dashboard permanecen explícitamente etiquetados como demostrativos. Las demás pantallas aún requieren una revisión de consistencia y accesibilidad conforme migren a API real.

## Fases y estado

### Cerradas en código (pendiente de validación operativa donde se indica)

- Auditoría estructural del núcleo y documentación de límites: realizada para esta revisión.
- Mongo/configuración, API estándar y capas route/controller/service/model: implementadas para dominios centrales.
- Autenticación, autorización RBAC, catálogos base y auditoría: implementados en el núcleo.
- Validación e índices: definidos en modelos; comprobarlos en la instancia objetivo.
- Capa API frontend y marco visual compartido: implementados; el resto de pantallas no está migrado funcionalmente.

### Parcial

- Pruebas de persistencia: existe una suite de integración real, pero no fue ejecutada aquí por falta de `TEST_MONGODB_URI`.
- Mongo Atlas: el código está preparado, pero esta auditoría no confirmó credenciales, conectividad ni índices de un clúster concreto.
- Frontend: catálogos y gestión central consumen endpoints reales; el dashboard y módulos marcados Demo todavía leen datos simulados.

### Pendiente según el orden del proyecto

1. Completar fase 12 ejecutando suite unitaria e integración con Mongo de pruebas compatible con transacciones; revisar fallos y evidencia.
2. Cerrar fase 13: armonizar pantallas con la capa común, gestionar expiración de sesión y visibilidad por permisos; evaluar el modelo de almacenamiento JWT para despliegue.
3. Fase 14: inventario persistente: existencias por almacén/producto, libro de movimientos inmutable, entradas, salidas, transferencias y ajustes; cada variación debe registrar actor, motivo, documento, saldo anterior/nuevo y fecha, y bloquear stock negativo salvo regla explícita. Usar transacciones y probar concurrencia.
4. Fases 15–16: ventas y compras persistentes con transiciones de estado válidas y coordinación transaccional con inventario.
5. Fases 17–19: finanzas, reportes e integraciones, cada uno respaldado por modelos, permisos, auditoría y pruebas antes de habilitar operación.
6. Fase 20 y migración futura a React Native/Web: diferidas hasta estabilizar módulos reales y validar necesidades de plataforma.

## Referencia visual y archivos añadidos

Las imágenes adjuntas se usaron únicamente como referencia visual. El texto incrustado en la captura de un panel ajeno no se interpreta como instrucción para el proyecto. El logo geométrico del corredor se conserva como el recurso entregado.

- Logo: `frontend/public/brand/logo-yordanup.png`.
- Shell común y navegación: `frontend/src/components/WorkspaceLayout.jsx`.
- Dashboard rediseñado, con indicadores rotulados como demostrativos: `frontend/src/screens/Dashboard/DashboardPage.jsx`.
- Estilos y adaptación móvil: `frontend/src/styles.css`.

La pasada complementaria aplica encabezado de sección y estado persistente/demo en todas las rutas autenticadas, con aviso visible en las pantallas de prototipo; también adapta la pantalla 404. Esto unifica la presentación del frontend web, pero no convierte endpoints o datos de muestra en persistentes ni crea componentes React Native.

## Criterio para declarar el núcleo listo

Antes de afirmar “núcleo persistente, seguro, validado y probado”, ejecutar la integración Mongo real (incluida atomicidad de auditoría y RBAC), verificar índices/configuración en el clúster de destino y revisar manejo de credenciales/sesión para despliegue. El criterio de ERP operativo requiere además completar inventario y luego sus módulos dependientes. Hasta entonces, usar únicamente usuarios, roles, catálogos y auditoría persistentes; tratar las áreas Demo como prototipo.
