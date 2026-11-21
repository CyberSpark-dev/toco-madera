-- =============================================================
-- TOCO MADERA | Etapa 3.19.4 | SOLO LECTURA
-- Consultar orden n.º 1 antes y después de su finalización.
-- =============================================================
USE toco_madera;

-- A. Estado y vinculación con el producto/pedido.
SELECT op.id_orden, op.estado, op.cantidad, op.id_receta,
       r.id_producto, op.id_detalle_pedido, op.texto_grabado,
       op.fecha_inicio, op.fecha_fin
FROM ordenes_produccion op
JOIN recetas r ON r.id_receta = op.id_receta
WHERE op.id_orden = 1;

-- B. Insumos registrados vs cantidades requeridas.
SELECT rm.id_material, m.nombre,
       rm.cantidad * op.cantidad AS requerido,
       COALESCE(SUM(cp.cantidad),0) AS consumido
FROM ordenes_produccion op
JOIN receta_materiales rm ON rm.id_receta=op.id_receta
JOIN materiales m ON m.id_material=rm.id_material
LEFT JOIN consumos_produccion cp
   ON cp.id_material=rm.id_material AND cp.id_orden=op.id_orden
WHERE op.id_orden = 1
GROUP BY rm.id_material, m.nombre, rm.cantidad, op.cantidad
ORDER BY rm.id_material;

-- C. Lotes ligados a la orden; inicialmente cero.
SELECT lp.id_lote, lp.id_orden, lp.id_producto,
       lp.id_detalle_pedido, lp.texto_grabado, lp.fecha_alta
FROM lotes_producto lp
WHERE lp.id_orden = 1;

-- D. Movimientos de entrada de producto de la orden 1.
SELECT mp.id_movimiento, mp.id_lote, mp.tipo,
       mp.cantidad_firmada, mp.id_detalle_pedido
FROM movimientos_producto mp
JOIN lotes_producto lp ON lp.id_lote = mp.id_lote
WHERE lp.id_orden = 1
ORDER BY mp.id_movimiento DESC;

-- E. Saldo por lote; refleja entradas y salidas de productos.
SELECT lp.id_lote, lp.id_producto,
       COALESCE(SUM(mp.cantidad_firmada),0) AS saldo_unidades
FROM lotes_producto lp
LEFT JOIN movimientos_producto mp ON mp.id_lote = lp.id_lote
WHERE lp.id_orden = 1
GROUP BY lp.id_lote, lp.id_producto;
