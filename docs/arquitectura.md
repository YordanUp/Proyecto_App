# Arquitectura del ERP

## Visión general

El ERP se diseña como un sistema modular con un backend centralizado y un frontend reutilizable para web y móvil. La intención es mantener separación clara de responsabilidades y preparar el sistema para crecimiento incremental.

## Capa frontend

- React Native para aplicaciones móviles.
- React Native Web para web.
- Navegación separada por módulos.
- Servicios HTTP encapsulados para consumir la API.
- Estado global para autenticación, permisos y notificaciones.

## Capa backend

- Express.js como servicio HTTP.
- Controladores para manejar solicitudes.
- Servicios para reglas de negocio.
- Modelos para MongoDB.
- Middleware para seguridad, validación, errores y autenticación.
- Utilidades para respuestas, fechas, auditoría y reportes.

## Capa de datos

Se usará MongoDB Atlas con colecciones específicas por dominio. Las relaciones se gestionarán con referencias y documentos embebidos cuando correspondan.

## Principios clave

- Frontend no conecta a MongoDB directamente.
- Reglas de negocio y validaciones críticas en backend.
- Auditoría obligatoria en cambios importantes.
- Permisos basados en roles (RBAC) con permisos específicos.
- Módulos aislados para permitir mantenimiento incremental.

## Flujo principal

1. Usuario accede desde web o móvil.
2. Frontend autentica a través de la API.
3. Backend valida credenciales, permisos y sesión.
4. Backend ejecuta servicios y consulta MongoDB.
5. Frontend presenta resultados con manejo de loaders, errores y estados vacíos.
