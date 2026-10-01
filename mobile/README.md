# YordanUp ERP Móvil

Aplicación Android interna basada en React Native + Expo SDK 57. Consume el backend existente; no crea una API ni una base de datos paralelas. Usa Expo Router para navegación por archivos y `expo-secure-store` para guardar únicamente el JWT.

## Ejecutar con Expo Go

Requisitos: Node.js 22.13+ y Expo Go instalado en un teléfono Android. El teléfono y la computadora deben estar en la misma red Wi-Fi para usar modo LAN.

```powershell
cd mobile
npm ci
npx expo start --lan
```

Abre Expo Go en Android y escanea el QR que aparece en la terminal. Si la red local bloquea el descubrimiento, prueba `npx expo start --tunnel` (necesita descargar el servicio de túnel).

La URL inicial del backend es `https://proyecto-app-backend-k3tn.onrender.com`. Para un entorno distinto, copia `.env.example` a `.env` dentro de `mobile/` y establece `EXPO_PUBLIC_API_URL`. Esa URL es pública y queda incluida en el bundle; no pongas secretos en variables `EXPO_PUBLIC_*`.

## Flujos

- `POST /api/auth/login`: autentica credenciales y recibe JWT.
- `GET /api/auth/me`: valida el token al abrir la aplicación.
- `POST /api/auth/logout`: intenta cerrar la sesión en el backend; el token local se borra aunque el servicio esté desconectado.
- `GET /api/dashboard`: muestra indicadores del prototipo con una marca visible de datos demo.
- `GET /api/products`, `/api/clients`, `/api/suppliers`, `/api/categories`, `/api/warehouses`: listas persistentes con búsqueda y paginación; crear, actualizar y desactivar solo cuando el usuario tenga los permisos correspondientes.
- `GET /api/inventory`, `/api/inventory/movements`, `/api/sales/quotations`, `/api/sales/sales`, `/api/purchases/orders`, `/api/purchases`, `/api/finance/accounts`, `/api/finance/movements`, `/api/finance/payments`: consulta de las APIs existentes. Se identifican como demo porque el backend actual los conserva en memoria.

Los permisos del usuario filtran pestañas, accesos y acciones en la interfaz. La API sigue aplicando la autorización definitiva.

## Verificaciones

```powershell
npm test
npx expo lint
npm run typecheck
npx expo-doctor
npx expo export --platform android
```

Las pruebas MOB-001 a MOB-010 cubren flujos de autenticación, token, permisos y acceso a los endpoints principales. La prueba física con Expo Go requiere un teléfono Android y el servicio backend disponible.

## APK interno de prueba

`eas.json` define un perfil `preview` con distribución interna y tipo `apk`; no configura una publicación en tienda ni un AAB. Después de validar el flujo en Expo Go, inicia sesión en una cuenta de Expo y solicita la compilación:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

EAS entrega un enlace privado de descarga para instalar el APK manualmente. La configuración local no contiene credenciales de firma ni acceso a Play Console.
