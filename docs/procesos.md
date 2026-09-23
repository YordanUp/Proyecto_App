# Procesos y workflow de desarrollo

## Orden de trabajo

1. Analizar el proyecto y detectar dependencias.
2. Definir estructura modular.
3. Implementar base y configuración.
4. Validar compilación y pruebas.
5. Avanzar a la siguiente fase si no hay bloqueantes.
6. Consolidar hardening y cierre de release.

## Reglas clave

- No priorizar velocidad por encima de estabilidad.
- Mantener coherencia entre frontend, backend y base de datos.
- No duplicar lógica ni mezclar responsabilidades.
- Registrar auditoría en operaciones críticas.
- No crear módulos o tecnologías adicionales sin necesidad.

## Fase de cierre

La etapa final del proyecto incluye:

- revisión de permisos y seguridad,
- comprobación de rutas y flujo autenticado,
- pruebas funcionales end-to-end,
- documentación del alcance entregado,
- preparación para entorno de prueba o producción.
