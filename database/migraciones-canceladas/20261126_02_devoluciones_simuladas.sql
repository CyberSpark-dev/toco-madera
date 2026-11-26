-- CANCELADA. Referencia histórica del ensayo aislado. Fuera del despliegue.
/*
CREATE TABLE devoluciones_pago (
 id_pago BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 monto DECIMAL(12,2) NOT NULL,
 fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 estado ENUM('DEVUELTO_SIMULADO') NOT NULL DEFAULT 'DEVUELTO_SIMULADO',
 id_ejecutor BIGINT UNSIGNED NOT NULL,
 CONSTRAINT chk_devolucion_monto CHECK (monto > 0),
 CONSTRAINT fk_devolucion_pago FOREIGN KEY (id_pago) REFERENCES pagos(id_pago),
 CONSTRAINT fk_devolucion_ejecutor FOREIGN KEY (id_ejecutor) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
*/
