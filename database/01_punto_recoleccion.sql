-- TOCO MADERA 3.19.5. Ejecutar una sola vez, con respaldo previo.
USE toco_madera;
-- La tabla entregas ya existe; no se eliminan registros.
ALTER TABLE entregas
  ADD COLUMN punto_recoleccion VARCHAR(200) NULL
  COMMENT 'Lugar acordado con el cliente; no inventar direcciones';

SELECT id_entrega,id_pedido,estado,programada,punto_recoleccion FROM entregas ORDER BY id_entrega DESC LIMIT 10;
