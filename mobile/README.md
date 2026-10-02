# YordanUp ERP Mobile

Cliente Android interno en React Native + Expo Router. Mobile consume la misma API que la web y no contiene acceso a MongoDB ni reglas financieras o de inventario. El backend Render valida permisos, precios, estados, stock, transacciones y auditoría.

## Arquitectura

`Expo Go / Android -> API Express en Render -> MongoDB Atlas`

- `src/api/client.js`: URL, JWT, timeout, reintento acotado de lecturas y errores HTTP.
- `src/context/AuthContext.js` y `src/storage/sessionStore.js`: sesión y JWT en `expo-secure-store`.
- `src/services/operationalService.js`: funciones para endpoints persistentes compartidos con la web.
- `src/app/`: rutas Expo Router y pantallas.
- `src/components/`: componentes reutilizables de carga, errores, selección, estados y acciones.

## Configuración y ejecución

Requiere Node.js 22.13 o posterior para Expo SDK 57. La variable pública opcional es:

```env
EXPO_PUBLIC_API_URL=https://proyecto-app-backend-k3tn.onrender.com
```

El mismo backend se usa por omisión. `EXPO_PUBLIC_*` se incorpora al cliente; no coloques tokens ni secretos ahí. Para instalar y abrir la app:

```powershell
cd mobile
npm.cmd ci
npx.cmd expo start --tunnel
```

Escanea el QR desde Expo Go. Tunnel ayuda cuando la red local no deja conectar el teléfono; puede ser más lento que LAN.

## Funciones conectadas

- Inicio: `GET /api/dashboard`, métricas, alertas de stock, ventas y movimientos financieros recientes.
- Inventario: `GET /api/inventory`, `/api/inventory/movements`; `POST /entry`, `/exit`, `/adjust`, `/transfer`.
- Ventas: listado, detalle, creación/edición de borradores, confirmación y cancelación mediante `/api/sales`.
- Compras: listado, detalle, creación/edición de borradores, ordenar, recibir y cancelar mediante `/api/purchases`.
- Finanzas: cuentas por cobrar/pagar, movimientos y pagos en `/api/finance`.
- Selectores reutilizan los catálogos persistentes de productos, clientes, proveedores y almacenes.

El servidor calcula y valida los importes definitivos. Confirmar una venta descuenta existencias; recibir una compra suma existencias y registra la cuenta por pagar. Las operaciones de pago y los movimientos permanecen en el backend.

## Autenticación, permisos y errores

- Login: `POST /api/auth/login`; restaura perfil con `GET /api/auth/me` y cierra con `POST /api/auth/logout`.
- El JWT se guarda únicamente en SecureStore; los errores `401` limpian la sesión local.
- El login identifica `EMAIL_NOT_VERIFIED` y permite reenviar la verificación.
- Pestañas, formularios y acciones se filtran con los permisos de `/api/auth/me`; el backend conserva la autorización definitiva.
- Una lectura GET puede reintentarse una sola vez tras error de conexión o HTTP 502/503/504. Operaciones POST/PUT nunca se reintentan automáticamente.
- La app espera hasta 60 segundos por respuesta y presenta aviso si Render está iniciando. No encola operaciones offline.
- El endpoint actual autoriza transferencia con `inventory.adjust`; Mobile sigue la autorización que realmente aplica el backend.

## Validaciones locales

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npx.cmd expo-doctor
npx.cmd expo start --tunnel
```

La suite cubre auth/JWT, errores, retries de lectura y mapeos de endpoints operativos. La validación contra una cuenta Render real requiere una cuenta de pruebas autorizada. Las pruebas unitarias no sustituyen esa comprobación entre dispositivos.

## APK

No se generó APK en esta fase. `eas.json` conserva el perfil interno `preview`; primero valida el cliente en Expo Go y luego ejecuta una fase separada de EAS Build.
