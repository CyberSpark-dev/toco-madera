-- TOCO MADERA | Etapa 3.19.3
-- Consultas DE SOLO LECTURA para la orden de prueba n.º 1.
USE toco_madera;

-- 1) Orden; debe seguir EN_PROCESO después de consumir.
SELECT id_orden, id_receta, cantidad, estado, fecha_inicio
FROM ordenes_produccion WHERE id_orden = 1;

-- 2) Consumos registrados para la orden.
SELECT id_consumo, id_orden, id_material, cantidad, costo_unitario_aplicado
FROM consumos_produccion WHERE id_orden = 1 ORDER BY id_material;

-- 3) Movimientos negativos generados para la misma orden.
SELECT id_movimiento, id_orden_produccion, id_material, tipo,
       cantidad_firmada, costo_unitario_aplicado
FROM movimientos_material
WHERE id_orden_produccion = 1 AND tipo = 'CONSUMO'
ORDER BY id_material;

-- 4) Comparar cantidad de filas: deben coincidir tras POST exitoso.
SELECT
  (SELECT COUNT(*) FROM consumos_produccion WHERE id_orden = 1) AS consumos,
  (SELECT COUNT(*) FROM movimientos_material
     WHERE id_orden_produccion = 1 AND tipo = 'CONSUMO') AS movimientos_consumo;

-- 5) Stock actual por material requerido según la receta de la orden.
SELECT rm.id_material, m.nombre,
       rm.cantidad * op.cantidad AS cantidad_requerida,
       COALESCE((SELECT SUM(mm.cantidad_firmada)
          FROM movimientos_material mm
          WHERE mm.id_material = rm.id_material), 0) AS stock_actual
FROM ordenes_produccion op
JOIN receta_materiales rm ON rm.id_receta = op.id_receta
JOIN materiales m ON m.id_material = rm.id_material
WHERE op.id_orden = 1 ORDER BY rm.id_material;
