# API REST

## Base

La API se expondrá bajo el prefijo `/api`.

## Endpoints base de la Fase 1

- `GET /api/health` — estado del backend
- `GET /api` — información del servicio

## Estructura de respuesta

### Éxito

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "message": "Ocurrió un error",
  "error": "ERROR_CODE"
}
```

## Convenciones

- Mantener nomenclatura consistente por módulo.
- Desarrollar endpoints RESTful.
- Usar validación del backend como fuente principal.
- No enviar información sensible al frontend.
