# Seguridad

## Medidas implementadas inicialmente

- Variables de entorno para configuración sensible.
- JWT para autenticación.
- CORS configurado.
- Validación de entrada en backend.
- Hash de contraseñas con bcrypt.
- Middleware de autorización por roles y permisos.
- Rate limiting para prevenir abuso.
- No se almacenan secretos en Git.

## Reglas

- El frontend no debe tener credenciales de MongoDB.
- La API debe impedir acceso no autenticado a rutas protegidas.
- Los errores internos no deben mostrarse al usuario final.
- Los permisos se validarán por módulo y acción.
