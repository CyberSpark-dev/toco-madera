-- TOCO MADERA - ETAPA 3.19.5: consultas solo lectura.
USE toco_madera;
-- Confirmar resultados de 3.19.4 antes de programar.
SELECT id_orden, estado, fecha_fin FROM ordenes_produccion WHERE id_orden = 1;
SELECT id_lote, id_producto, id_detalle_pedido, id_orden FROM lotes_producto WHERE id_orden=1;
SELECT mp.id_movimiento,mp.tipo,mp.cantidad_firmada FROM movimientos_producto mp
JOIN lotes_producto lp ON lp.id_lote=mp.id_lote WHERE lp.id_orden=1;
-- Seguimiento de entregas.
SELECT p.id_pedido,p.folio,p.estado,p.fecha_entrega_prometida,p.tipo_entrega,
       e.estado AS estado_entrega,e.programada,e.punto_recoleccion,e.entregada,e.receptor
FROM pedidos p LEFT JOIN entregas e ON e.id_pedido=p.id_pedido
WHERE p.id_pedido=5;
-- Ver saldo y pagos simulados.
SELECT id_pago,id_pedido,monto,metodo,estado,referencia FROM pagos WHERE id_pedido=5;
-- Ver movimientos del detalle 5 (incluida la salida si se entregó).
SELECT mp.id_movimiento,mp.tipo,mp.cantidad_firmada,mp.id_detalle_pedido FROM movimientos_producto mp
WHERE mp.id_detalle_pedido=5 ORDER BY mp.id_movimiento;
