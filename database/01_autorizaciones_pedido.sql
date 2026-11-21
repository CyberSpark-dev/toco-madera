-- Toco Madera 3.20.2 - EJECUTAR UNA SOLA VEZ DESPUES DE RESPALDAR LA BD.
-- NO cambia el ENUM ni los pedidos existentes.
USE toco_madera;
CREATE TABLE IF NOT EXISTS autorizaciones_pedido (
  id_pedido BIGINT UNSIGNED NOT NULL,
  estado ENUM('APROBADO','RECHAZADO') NOT NULL,
  id_admin BIGINT UNSIGNED NOT NULL,
  motivo VARCHAR(300) DEFAULT NULL,
  fecha_decision DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_pedido),
  KEY ix_autorizaciones_admin (id_admin),
  CONSTRAINT fk_autorizaciones_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
  CONSTRAINT fk_autorizaciones_admin FOREIGN KEY (id_admin) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Pedidos antiguos CONFIRMADO permanecen pendientes de autorizacion.
-- Los ya ENTREGADO quedan como historicos, no se modifican.
SELECT p.id_pedido,p.estado,COALESCE(a.estado,'POR_REVISAR') AS autorizacion
FROM pedidos p LEFT JOIN autorizaciones_pedido a ON a.id_pedido=p.id_pedido
ORDER BY p.id_pedido;
