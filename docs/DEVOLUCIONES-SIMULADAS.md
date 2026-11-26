# Devoluciones simuladas ? canceladas

La migración `20261126_02_devoluciones_simuladas.sql` se conserva comentada en `database/migraciones-canceladas/` como referencia del ensayo previo. Se comprobó en solo lectura que `devoluciones_pago` está ausente en la base principal `toco_madera` (puerto 3306). La tabla del ensayo aislado permanece intacta. El archivo queda fuera del procedimiento de despliegue.

El flujo activo cancela pedidos propios confirmados cuando aún no tienen orden de producción, entrega ni reserva activa de inventario. La autorización del taller por sí sola permite conservar esa opción. La operación cambia el estado del pedido y conserva todos los pagos simulados en su historial. El Dashboard mantiene la definición original de sus indicadores.
