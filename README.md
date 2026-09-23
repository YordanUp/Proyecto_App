# ERP Modular

## Estado actual

El proyecto se inició desde una base vacía. No existía código fuente previo ni dependencias instaladas en el workspace. Se definió la arquitectura base para un ERP modular con frontend web/móvil, backend API REST en Node.js + Express y base de datos MongoDB Atlas.

## Objetivo

Construir una plataforma ERP para centralizar administración, ventas, compras, inventario, finanzas, reportes, auditoría y seguridad, manteniendo un diseño modular y reutilizable entre React Native y React Native Web.

## Arquitectura general

- Frontend: React Native + React Native Web
- Backend: Node.js + Express
- Base de datos: MongoDB Atlas
- Seguridad: JWT, validaciones, CORS, rate limiting, variables de entorno
- Auditoría: registro de cambios críticos
- Modularidad: separados por dominio y responsabilidades

## Estructura propuesta

```text
ERP/
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── README.md
├── backend/
│   ├── src/
│   ├── tests/
│   ├── package.json
│   ├── server.js
│   ├── .env.example
│   └── README.md
├── docs/
│   ├── arquitectura.md
│   ├── base-datos.md
│   ├── api.md
│   ├── seguridad.md
│   ├── qa.md
│   └── procesos.md
├── tests/
│   └── qa-fase-1.md
├── .gitignore
├── .env.example
├── README.md
└── .gitignore
```

## Orden de implementación

1. Fase 1: estructura base, backend, frontend, variables de entorno, MongoDB, API básica.
2. Fase 2: autenticación, usuarios, roles, permisos.
3. Fase 3: clientes, proveedores, categorías, productos, almacenes.
4. Fase 4: inventario y movimientos.
5. Fase 5: cotizaciones, ventas y devoluciones.
6. Fase 6: compras, recepciones y devoluciones.
7. Fase 7: finanzas.
8. Fase 8: dashboard, reportes y notificaciones.
9. Fase 9: auditoría avanzada, integraciones.
10. Fase 10: optimización, mobile, Kotlin si aplica e IA.

## Regla arquitectónica principal

El frontend no se conecta directamente a MongoDB. La comunicación sigue esta ruta:

React Native / React Native Web → HTTPS → Node.js + Express → servicios y reglas de negocio → MongoDB Atlas

## Fase actual

El ERP modular quedó consolidado en las fases funcionales de negocio, seguridad, reportes, monitoreo e integraciones. La base ya está validada y el proyecto avanza hacia la etapa final de cierre: hardening, QA integral, documentación de release y preparación para despliegue.

## Estado de validación

- Backend: 38 pruebas ejecutadas con 38 aprobadas.
- Frontend: 16 pruebas ejecutadas con 16 aprobadas.
- Cobertura funcional: autenticación, roles, permisos, catálogo, inventario, ventas, compras, finanzas, dashboard, reportes, monitoreo e integraciones.

## Cierre del proyecto

La entrega actual está enfocada en:

1. Revisión final de seguridad y permisos.
2. Validación de flujos críticos del ERP.
3. Documentación de despliegue y operación.
4. Preparación para entorno de pruebas o producción.
