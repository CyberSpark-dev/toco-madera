-- CANCELADA. Referencia histórica del ensayo aislado. Fuera del despliegue.
/*
ALTER TABLE pedido_detalles
  ADD COLUMN estilo_grabado VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD CONSTRAINT ck_pedido_detalles_estilo_grabado
    CHECK (estilo_grabado IS NULL OR
      (texto_grabado IS NOT NULL AND estilo_grabado IN ('cursiva', 'normal', 'inglesa')));
*/
