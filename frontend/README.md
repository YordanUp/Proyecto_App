# Frontend ERP

Frontend web React + Vite existente. Las pantallas se conservan; no se ha iniciado la migración a React Native.

`src/services/api.js` contiene el cliente común de API: URL base (`VITE_API_URL`), cabeceras/token, JSON y mensajes de error. Los catálogos/usuarios/roles consumen persistencia Mongo a través del backend; las vistas de módulos pendientes aún muestran las respuestas prototipo indicadas en el README raíz.

```powershell
npm ci
npm run dev
npm test
npm run build
```
