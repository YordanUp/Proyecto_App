# Backend ERP

## Objetivo

Proveer una API REST segura y modular para gestionar ERP con autenticación, usuarios, permisos, inventario y módulos administrativos.

## Tecnologías

- Node.js
- Express.js
- MongoDB Atlas
- JWT
- Helmet, CORS, rate limiting
- Joi para validación

## Comandos

```bash
npm install
npm run dev
npm test
```

## Endpoints base

- GET /api/health
- GET /api

## Reglas de negocio implementadas en la base

- Validación de entrada en backend.
- Respuestas estandarizadas.
- CORS y seguridad básica.
- No se conectan credenciales de base de datos desde frontend.
