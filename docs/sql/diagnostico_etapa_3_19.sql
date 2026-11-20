-- ================================================================
-- TOCO MADERA - ETAPA 3.19.1
-- DIAGNÓSTICO DE PRODUCCIÓN, INVENTARIO Y ENTREGAS
-- SOLO CONSULTAS: NO MODIFICA TABLAS NI REGISTROS
-- Ejecutar en MySQL Workbench en la conexión local de desarrollo.
-- ================================================================
USE toco_madera;

-- 1) Tablas y vistas reales disponibles en esta instalación.
SELECT TABLE_NAME, TABLE_TYPE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'ordenes_produccion', 'consumos_produccion',
    'movimientos_material', 'movimientos_producto',
    'lotes_producto', 'reservas_producto', 'entregas',
    'pedidos', 'pedido_detalles', 'pagos',
    'materiales', 'recetas', 'receta_materiales',
    'productos', 'vw_saldos_pedidos'
  )
ORDER BY TABLE_NAME;

-- 2) Estructura completa de las tablas de fabricación.
SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME,
       COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY,
       COLUMN_DEFAULT, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'ordenes_produccion', 'consumos_produccion',
    'movimientos_material', 'movimientos_producto',
    'lotes_producto', 'reservas_producto', 'entregas',
    'recetas', 'receta_materiales',
    'pedido_detalles', 'pedidos', 'pagos', 'materiales'
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 3) Claves foráneas de la cadena pedido-fabricación-entrega.
SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME,
       REFERENCED_COLUMN_NAME, CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME IS NOT NULL
  AND TABLE_NAME IN (
    'ordenes_produccion', 'consumos_produccion',
    'movimientos_material', 'movimientos_producto',
    'lotes_producto', 'reservas_producto', 'entregas',
    'recetas', 'receta_materiales'
  )
ORDER BY TABLE_NAME, COLUMN_NAME;

-- 4) Índices y unicidad de operaciones de inventario.
SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE,
       SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'ordenes_produccion', 'consumos_produccion',
    'movimientos_material', 'movimientos_producto',
    'lotes_producto', 'reservas_producto', 'entregas'
  )
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 5) Pedidos y renglones de fabricación, solo para conocer
-- el estado inicial. No modifica estados ni saldos.
SELECT p.id_pedido, p.folio, p.estado AS estado_pedido,
       d.id_detalle_pedido, d.id_producto, d.cantidad,
       d.tipo_surtido
FROM pedidos AS p
JOIN pedido_detalles AS d ON d.id_pedido = p.id_pedido
ORDER BY p.id_pedido DESC, d.id_detalle_pedido
LIMIT 50;

-- 6) Recetas existentes y versiones por producto.
SELECT r.id_receta, r.id_producto, r.version, r.vigente,
       COUNT(rm.id_material) AS materiales_en_receta
FROM recetas AS r
LEFT JOIN receta_materiales AS rm ON rm.id_receta = r.id_receta
GROUP BY r.id_receta, r.id_producto, r.version, r.vigente
ORDER BY r.id_producto, r.version DESC;

-- 7) Existencia por material según libro firmado.
SELECT m.id_material, m.nombre, m.stock_minimo,
       COALESCE(SUM(mm.cantidad_firmada), 0) AS existencia
FROM materiales AS m
LEFT JOIN movimientos_material AS mm ON mm.id_material = m.id_material
GROUP BY m.id_material, m.nombre, m.stock_minimo
ORDER BY m.id_material;

-- 8) Estados de órdenes y entregas, si ya existen registros.
SELECT estado, COUNT(*) AS total
FROM ordenes_produccion
GROUP BY estado;
SELECT estado, COUNT(*) AS total
FROM entregas
GROUP BY estado;
