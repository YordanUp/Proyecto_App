# Base de datos MongoDB Atlas

## Colecciones sugeridas

- usuarios
- roles
- permisos
- clientes
- proveedores
- productos
- categorias
- almacenes
- inventarios
- movimientos_inventario
- cotizaciones
- ventas
- devoluciones_venta
- solicitudes_compra
- compras
- recepciones
- devoluciones_compra
- cuentas_por_cobrar
- cuentas_por_pagar
- movimientos_financieros
- notificaciones
- auditorias
- configuraciones

## Consideraciones

- Usar referencias para entidades independientes con alta frecuencia de consulta.
- Usar documentos embebidos para datos secundarios o de baja volatilidad.
- Crear índices para usuario, estado, código, fecha, cliente, proveedor y producto.
- No crear relaciones innecesarias ni duplicación de datos.

## Reglas de integridad

- Códigos únicos para productos, clientes y proveedores relevantes.
- No permitir inventario negativo salvo configuración explícita.
- Registrar movimientos de inventario con usuario, almacén, motivo y documento.
- Auditar cambios de permisos, configuraciones y estados críticos.
