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

Usuarios, roles, catálogos, existencias, movimientos de inventario, ventas, compras, cotizaciones, cuentas por cobrar/pagar, movimientos financieros, notificaciones, configuración general, dashboard, reportes analíticos y auditoría usan MongoDB. Solicitudes de devolución, ajustes e integraciones visibles aún son demostrativos; consulta el README raíz antes de usarlos.

Dashboard (`GET /api/dashboard`, permiso `dashboard.read`) calcula indicadores con ventas confirmadas por día/mes UTC, compras, inventario y cuentas financieras, e incluye listas recientes. Los reportes (`GET /api/reports/data/:type`, permiso `reports.read`) permiten consultar ventas, compras, existencias, movimientos de inventario, CxC, CxP y movimientos financieros con filtros, orden, paginación y totales. El endpoint `/export.csv` respeta esos filtros, limita la exportación a 10,000 filas y registra la acción en auditoría.

Las operaciones de usuario, rol, catálogo, configuración, inventario, ventas y compras escriben el cambio y el evento de auditoría en una transacción. Entradas, salidas y ajustes guardan movimiento y existencia juntos. Una transferencia modifica ambas existencias, crea los dos movimientos y audita en la misma transacción. Confirmar o cancelar una venta actualiza su estado, inventario, movimientos y auditoría en una sola transacción. Recibir una compra actualiza el estado, las existencias, los movimientos de recepción y la auditoría en una sola transacción. Se requiere MongoDB Atlas o MongoDB configurado como replica set.

En producción `autoIndex` está desactivado: después de revisar el entorno ejecuta `npm run db:indexes` para crear los índices declarados de catálogos, configuración, inventario, ventas, compras, cuentas financieras, movimientos y secuencias (no elimina índices existentes).

## Configuración persistente

`SystemSetting` persiste únicamente `company_name`, `currency`, `timezone` y `date_format`. Moneda acepta `MXN`, `USD` o `EUR`; zona horaria `America/Mexico_City` o `UTC`; formato de fecha `DD/MM/YYYY`, `MM/DD/YYYY` o `YYYY-MM-DD`. Los valores iniciales se sincronizan de forma controlada con `npm run db:sync-settings -- --dry-run` y luego `npm run db:sync-settings -- --apply`; el proceso crea solo claves faltantes y conserva personalizaciones. La API permite listar con `GET /api/settings` (`settings.read`) y actualizar una clave permitida mediante `PUT /api/settings/:key` (`settings.update`). Cada cambio y su evento `settings.update` se guardan en una transacción; no existe creación libre ni se aceptan secretos. Moneda, zona horaria y formato de fecha son por ahora informativos y no cambian todos los formatos de pantalla.

## API y seguridad

El JWT solo lleva `sub`; el middleware recarga el estado del usuario y los permisos efectivos de su rol. Las contraseñas se almacenan con bcrypt, nunca en texto plano. Los errores 5xx se sanitizan. `GET /api/health` indica disponibilidad conjunta de API y base.

Los catálogos permiten `search`, `status`, `page`, `limit` (máximo 100), `sort` y `order`. Las bajas son lógicas; la API no ofrece borrado físico de catálogos o eventos de auditoría.

## Inventario persistente

`InventoryStock` tiene una existencia por producto y almacén, con índice único compuesto, cantidad reservada y mínimo. `InventoryMovement` conserva el tipo, cantidad antes/después, motivo, referencias, actor y fecha; no hay endpoint para editar o borrar movimientos. Toda entrada, salida, ajuste y transferencia actualiza existencias dentro de una transacción y registra auditoría. Las salidas y transferencias verifican de forma atómica el stock disponible (`quantity - reservedQuantity`) y no aceptan cantidades negativas.

Endpoints autenticados: `GET /api/inventory`, `GET /api/inventory/movements`, `GET /api/inventory/warehouses`, `POST /api/inventory/entry`, `POST /api/inventory/exit`, `POST /api/inventory/adjust` y `POST /api/inventory/transfer`. Las consultas aceptan filtros `search`, `warehouseId`, `productId`, `type`, fechas `from`/`to`, paginación `page`/`limit` y `lowStock=true` para existencias. Entrada/salida requieren `inventory.create`; ajuste/transferencia usan `inventory.adjust`, el permiso existente, para no exigir una migración RBAC a los roles bootstrap actuales. El actor siempre se toma del JWT, nunca del body. Los antiguos arrays demo no se importan a MongoDB.

## Ventas persistentes

`Sale` persiste cliente, artículos, snapshots del nombre/SKU/precio, impuestos, totales, folio `VEN-AAAA-######`, usuario creador, estado y fechas. La secuencia anual de folios usa un contador atómico y un índice único. Crear o editar un borrador no toca inventario. Confirmar valida cliente, producto, almacén y stock disponible; descuenta existencias y crea movimientos `SALE`. Cancelar un borrador solo cambia estado; cancelar una venta confirmada repone existencias y crea movimientos `RETURN`. Estado, cambios de stock, movimientos y auditoría comparten transacción. Se respetan las cantidades reservadas; la confirmación concurrente no permite sobreventa.

Endpoints autenticados: `GET /api/sales` (busca folio/cliente; filtra `status`, `customerId`, `from`, `to`; pagina y ordena), `GET /api/sales/:id`, `POST /api/sales`, `PUT /api/sales/:id`, `POST /api/sales/:id/confirm` y `POST /api/sales/:id/cancel`. Los borradores requieren `sales.create`; editar requiere `sales.update`; cancelar requiere `sales.cancel`; lectura requiere `sales.read`. No existe `sales.confirm` en el catálogo de permisos, por lo que confirmar usa el permiso existente `sales.create`. El servidor calcula precios, impuestos y totales; la UI no establece el estado ni los totales finales.

### Cotizaciones

Las cotizaciones se guardan en MongoDB en `Quotation`; ya no se sirven desde datos en memoria. Bajo `/api/sales/quotations` se ofrecen listado paginado con `page`, `limit`, `search`, `status`, `sort` y `order`; detalle; creación; edición solo en `draft`; acciones `send`, `accept`, `reject`, `cancel` y conversión. Los folios siguen `COT-AAAA-######` y usan `Sequence` dentro de transacción. El servidor valida cliente/productos/almacenes activos y vuelve a calcular precios, impuestos y totales. Los permisos reutilizan `sales.read`, `sales.create`, `sales.update` y `sales.cancel`.

La conversión solo admite cotizaciones `accepted` y, en una única transacción, crea una venta normal `draft`, enlaza `saleId`, actualiza la cotización a `converted` y registra auditoría. Convertir no descuenta inventario ni crea cuentas por cobrar o movimientos financieros; esos efectos ocurren al confirmar después la venta con el flujo existente. Los eventos de cotización usan `quotation.create`, `quotation.update`, `quotation.send`, `quotation.accept`, `quotation.reject`, `quotation.cancel` y `quotation.convert`. Para instalar/verificar índices en la base configurada, ejecutar `npm run db:indexes`.

Las solicitudes de devolución continúan siendo demostrativas y mantienen su almacenamiento heredado en memoria; están fuera de esta fase.

## Notificaciones persistentes

`Notification` guarda notificaciones por usuario, estado (no leída/leída), prioridad, módulo, referencia opcional y metadatos limitados. La API autenticada ofrece `GET /api/notifications` con `status`, `type`, `module`, `page`, `limit`, `sort` y `order`; `GET /api/notifications/unread-count`; `GET /api/notifications/:id`; `POST /api/notifications/:id/read`; `POST /api/notifications/read-all`; y `POST /api/notifications` para crear una notificación con `notifications.create`. Los usuarios solo pueden consultar o marcar sus propios registros; la creación para otro usuario requiere que este exista y esté activo. La acción manual queda auditada.

El sistema crea eventos internos para stock bajo, confirmación de venta, recepción de compra, pagos y conversión de cotización, dentro de la transacción MongoDB de la operación origen. Stock bajo se deduplica por usuario, tipo y existencia mientras haya una notificación no leída. Se requiere el permiso de lectura del módulo correspondiente para recibir esos eventos (`inventory.read`, `sales.read`, `purchases.read`, `finance.read`). La notificación no sustituye la auditoría y actualmente no despacha correo ni push.

## Compras persistentes

`Purchase` guarda proveedor, líneas con snapshots de producto/SKU/costo, impuestos, totales, almacén, usuario creador, estado y fechas. El folio `COM-AAAA-######` usa una secuencia anual atómica y un índice único. Crear/editar un borrador no cambia existencias. El flujo permite `draft → ordered → received` y cancelar solo desde `draft` u `ordered`. Recibir una compra ordenada valida proveedor, productos y almacenes activos; incrementa inventario, conserva `reservedQuantity`, genera un movimiento `PURCHASE`, crea la CxP y registra auditoría en una sola transacción. La recepción repetida y cancelar compras recibidas se rechazan.

## Finanzas persistentes

`AccountsReceivable` y `AccountsPayable` se crean al confirmar ventas y recibir compras, respectivamente, dentro de esas mismas transacciones; cada referencia de origen tiene índice único. Los folios `CXC-AAAA-######` y `CXP-AAAA-######` usan secuencias anuales atómicas. Los pagos parciales/completos validan saldo y actualizan la cuenta, crean un `FinancialMovement` inmutable y registran auditoría en una transacción. Los movimientos de cobro son `RECEIVABLE_PAYMENT/IN`; los pagos a proveedor son `PAYABLE_PAYMENT/OUT`. El estado se deriva del saldo. No se permiten sobrepagos ni saldos negativos.

Endpoints autenticados: `GET /api/finance/receivables`, `GET /api/finance/receivables/:id`, `POST /api/finance/receivables/:id/payments`, equivalentes `/payables`, y `GET /api/finance/movements`. Los listados ofrecen búsqueda, estado, fechas, entidad relacionada, orden y paginación. `GET /api/finance/payments` permanece como alias de solo lectura del registro de movimientos. Las antiguas rutas genéricas de cuentas y escrituras financieras de demostración se retiraron; `src/data/finance.js` se eliminó y sus datos demo no se importaron.

Permisos de lectura: `finance.read`; registrar cobros requiere `finance.receive_payment`, y pagos a proveedores requieren `finance.make_payment`. Estos dos permisos son nuevos y no se asignan automáticamente a roles ya almacenados; deben agregarse explícitamente a los roles autorizados. Cancelar una venta confirmada cancela su CxC si no tiene pagos. Si ya hay pagos, la cancelación se rechaza para preservar el historial y el inventario hasta que exista un flujo explícito de reembolso. No se cancelan CxP ligadas a compras recibidas. No se implementan cuentas contables, impuestos fiscales, conciliación ni reembolsos.

Endpoints autenticados: `GET /api/purchases` (búsqueda por folio/proveedor, filtros, paginación y orden), `GET /api/purchases/:id`, `POST /api/purchases`, `PUT/PATCH /api/purchases/:id`, `POST /api/purchases/:id/order`, `POST /api/purchases/:id/receive` y `POST /api/purchases/:id/cancel`. Los permisos son `purchases.read`, `purchases.create`, `purchases.update`, `purchases.approve`, `purchases.receive` y `purchases.cancel`. `GET/POST /api/purchases/orders` se conservan como alias compatibles del mismo recurso persistente; no crean una colección separada. El archivo antiguo `src/data/purchases.js` queda sin referencias: sus datos de demostración no se migran ni se sirven por la API.

Los permisos `purchases.update` y `purchases.receive` son nuevos. No se asignan automáticamente a roles ya almacenados; un administrador debe agregarlos explícitamente a los roles que correspondan.

## Correo transaccional y verificación

La creación administrativa de usuarios crea una cuenta sin verificar y solicita el correo de confirmación. Configura `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_PUBLIC_URL` y `EMAIL_ENABLED=true` para activar entregas; con `EMAIL_ENABLED=false` no se envían correos y las cuentas nuevas permanecen pendientes. `RESEND_API_KEY` es solo del backend. En Render define las variables como secretos/configuración del servicio, sin registrarlas en el repositorio.

`POST /api/auth/verify-email` recibe `{ "token": "..." }`; `POST /api/auth/resend-verification` recibe `{ "email": "..." }` y siempre contesta de forma genérica. El reenvío se limita a cinco solicitudes por IP cada 15 minutos. Los tokens aleatorios duran 24 horas y MongoDB guarda solo su SHA-256. El login responde `403 EMAIL_NOT_VERIFIED` después de validar credenciales. El administrador bootstrap y los documentos antiguos sin el campo `emailVerified` se consideran verificados para no interrumpir producción; los nuevos usuarios creados mediante `/api/users` requieren verificación. Cambiar el correo de un usuario reinicia la verificación.

Con `onboarding@resend.dev`, Resend está en modo de prueba y solo admite destinatarios autorizados por la cuenta de Resend. Un rechazo no borra la cuenta, que puede solicitar otro correo. Para enviar a cualquier usuario se debe verificar un dominio propio en Resend; no se falsifica un remitente de Gmail/Outlook. El correo de bienvenida se intenta una sola vez después de la confirmación, nunca contiene contraseña.

Endpoints web: `/verify-email?token=...` y `/login`. La app móvil consume el endpoint de reenvío, mientras que el enlace del correo abre la web.

## Pruebas

`npm test` ejecuta validaciones de modelos/hash, inventario, ventas y unidades de tokens/plantillas de correo. Las suites `persistence.integration.test.js`, `purchases.integration.test.js` y `finance.integration.test.js` cubren el núcleo, transacciones, RBAC, movimientos, pagos y concurrencia. Cargan `backend/.env`, requieren `TEST_MONGODB_URI` compatible con transacciones y crean/eliminan únicamente bases aisladas de pruebas; no usan `MONGODB_URI` para pruebas destructivas.
