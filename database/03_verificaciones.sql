-- Consulta de diagnostico, no altera datos.
USE toco_madera;
SELECT 'tablas' AS concepto,COUNT(*) AS total FROM information_schema.tables
 WHERE table_schema='toco_madera' AND table_type='BASE TABLE';
SELECT 'vistas' AS concepto,COUNT(*) AS total FROM information_schema.views
 WHERE table_schema='toco_madera';
SELECT id_producto,sku,nombre,precio_lista FROM productos ORDER BY id_producto;
SELECT r.id_receta,p.nombre,m.nombre AS material,rm.cantidad,u.codigo
 FROM receta_materiales rm
 JOIN recetas r ON r.id_receta=rm.id_receta
 JOIN productos p ON p.id_producto=r.id_producto
 JOIN materiales m ON m.id_material=rm.id_material
 JOIN unidades_medida u ON u.id_unidad=m.id_unidad
 ORDER BY r.id_receta,m.id_material;
SELECT * FROM vw_stock_materiales;
SELECT * FROM vw_stock_productos;
SELECT * FROM vw_saldos_pedidos;
-- Los valores de stock deben ser CERO: una cotizacion no es compra.
-- No hay usuarios ni pedidos hasta completar auth y ventas.
