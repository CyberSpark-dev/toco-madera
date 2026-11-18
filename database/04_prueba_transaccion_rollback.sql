-- Prueba opcional sobre BD NUEVA, despues de 01 y 02.
-- Crea una compra de PRUEBA dentro de transaccion y la revierte.
-- No registra compras ni inventario permanentes.
USE toco_madera;
START TRANSACTION;
INSERT INTO proveedores(nombre,contacto,activo)
 VALUES('PROVEEDOR TEMPORAL QA - NO REAL','Solo prueba de ROLLBACK',TRUE);
SET @qa_proveedor = LAST_INSERT_ID();
INSERT INTO compras(id_proveedor,estado,observaciones)
 VALUES(@qa_proveedor,'BORRADOR','Prueba temporal de rollback');
SET @qa_compra = LAST_INSERT_ID();
INSERT INTO compra_detalles(id_compra,id_material,cantidad,costo_unitario)
 VALUES(@qa_compra,1,0.3416,573.7705);
-- Aun no se ha recibido compra; no se inserta movimiento de inventario.
SELECT * FROM compras WHERE id_compra=@qa_compra;
ROLLBACK;
SELECT COUNT(*) AS compras_qa_despues_rollback FROM compras WHERE id_compra=@qa_compra;
-- Debe dar 0; demuestra transaccionalidad InnoDB.
