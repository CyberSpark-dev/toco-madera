-- TOCO MADERA | MySQL >=8.0.16 | ETAPA 2.6 | 25 tablas y 4 vistas
-- Dashboard administrativo CON graficas obligatorias: endpoints y agregaciones pendientes.
-- Ejecutar SOLO en BD nueva; este archivo NO borra datos existentes.
-- No crear usuarios con contrasenas en texto plano.
CREATE DATABASE IF NOT EXISTS toco_madera
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE toco_madera;

-- 1. IDENTIDAD / ROLES
CREATE TABLE IF NOT EXISTS roles (
 id_rol TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(30) NOT NULL UNIQUE,
 descripcion VARCHAR(150)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS usuarios (
 id_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_rol TINYINT UNSIGNED NOT NULL,
 nombre VARCHAR(120) NOT NULL,
 correo VARCHAR(190) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 telefono VARCHAR(25),
 activo BOOLEAN NOT NULL DEFAULT TRUE,
 creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_usuarios_roles FOREIGN KEY(id_rol) REFERENCES roles(id_rol)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS direcciones (
 id_direccion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_usuario BIGINT UNSIGNED NOT NULL,
 etiqueta VARCHAR(40) NOT NULL DEFAULT 'Principal',
 calle VARCHAR(150) NOT NULL, numero VARCHAR(20), colonia VARCHAR(120),
 ciudad VARCHAR(100) NOT NULL, estado VARCHAR(100) NOT NULL,
 codigo_postal VARCHAR(10), referencia VARCHAR(250),
 CONSTRAINT fk_direcciones_usuario FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

-- 2. PROVEEDORES, UNIDADES, MATERIALES Y COTIZACIONES
CREATE TABLE IF NOT EXISTS proveedores (
 id_proveedor BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(160) NOT NULL, contacto VARCHAR(120), telefono VARCHAR(25),
 correo VARCHAR(190), direccion VARCHAR(250), sitio_web VARCHAR(500),
 activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS unidades_medida (
 id_unidad SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 codigo VARCHAR(12) NOT NULL UNIQUE,
 nombre VARCHAR(50) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS materiales (
 id_material BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 sku VARCHAR(40) NOT NULL UNIQUE, nombre VARCHAR(150) NOT NULL,
 descripcion VARCHAR(250), id_unidad SMALLINT UNSIGNED NOT NULL,
 stock_minimo DECIMAL(14,4) NOT NULL DEFAULT 0,
 activo BOOLEAN NOT NULL DEFAULT TRUE,
 CONSTRAINT chk_materiales_minimo CHECK(stock_minimo >= 0),
 CONSTRAINT fk_materiales_unidad FOREIGN KEY(id_unidad) REFERENCES unidades_medida(id_unidad)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cotizaciones_material (
 id_cotizacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_material BIGINT UNSIGNED NOT NULL, id_proveedor BIGINT UNSIGNED NULL,
 fecha DATE NOT NULL, presentacion VARCHAR(160) NOT NULL,
 cantidad_base DECIMAL(14,4) NOT NULL,
 precio_presentacion DECIMAL(13,2) NOT NULL,
 moneda CHAR(3) NOT NULL DEFAULT 'MXN',
 clasificacion ENUM('PUBLICADA','COTIZADA','ESTIMADA') NOT NULL,
 url_fuente VARCHAR(700), observaciones VARCHAR(250),
 CONSTRAINT chk_cot_cantidad CHECK (cantidad_base > 0),
 CONSTRAINT chk_cot_precio CHECK (precio_presentacion >= 0),
 CONSTRAINT fk_cot_material FOREIGN KEY(id_material) REFERENCES materiales(id_material),
 CONSTRAINT fk_cot_proveedor FOREIGN KEY(id_proveedor) REFERENCES proveedores(id_proveedor),
 INDEX ix_cot_material_fecha (id_material,fecha)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS compras (
 id_compra BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_proveedor BIGINT UNSIGNED NOT NULL,
 id_usuario_registro BIGINT UNSIGNED NULL,
 fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 estado ENUM('BORRADOR','RECIBIDA','CANCELADA') NOT NULL DEFAULT 'BORRADOR',
 referencia_documento VARCHAR(90), observaciones VARCHAR(300),
 CONSTRAINT fk_compras_proveedor FOREIGN KEY(id_proveedor) REFERENCES proveedores(id_proveedor),
 CONSTRAINT fk_compras_usuario FOREIGN KEY(id_usuario_registro) REFERENCES usuarios(id_usuario),
 INDEX ix_compra_estado_fecha(estado,fecha)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS compra_detalles (
 id_detalle_compra BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_compra BIGINT UNSIGNED NOT NULL, id_material BIGINT UNSIGNED NOT NULL,
 cantidad DECIMAL(14,4) NOT NULL,
 costo_unitario DECIMAL(14,4) NOT NULL,
 CONSTRAINT chk_cd_cantidad CHECK (cantidad > 0),
 CONSTRAINT chk_cd_costo CHECK (costo_unitario >= 0),
 CONSTRAINT fk_cd_compra FOREIGN KEY(id_compra) REFERENCES compras(id_compra),
 CONSTRAINT fk_cd_material FOREIGN KEY(id_material) REFERENCES materiales(id_material),
 INDEX ix_cd_material(id_material)
) ENGINE=InnoDB;

-- Movimientos inmutables contabilizan EXISTENCIAS, no precios de catalogo.
CREATE TABLE IF NOT EXISTS movimientos_material (
 id_movimiento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_material BIGINT UNSIGNED NOT NULL,
 fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 tipo ENUM('COMPRA','CONSUMO','AJUSTE','DEVOLUCION') NOT NULL,
 cantidad_firmada DECIMAL(14,4) NOT NULL,
 costo_unitario_aplicado DECIMAL(14,4) NULL,
 id_detalle_compra BIGINT UNSIGNED NULL,
 id_orden_produccion BIGINT UNSIGNED NULL,
 observaciones VARCHAR(250),
 CONSTRAINT chk_mm_cantidad CHECK(cantidad_firmada <> 0),
 CONSTRAINT chk_mm_costo CHECK(costo_unitario_aplicado IS NULL OR costo_unitario_aplicado >= 0),
 CONSTRAINT chk_mm_tipo_signo CHECK (
   (tipo = 'COMPRA' AND cantidad_firmada > 0)
   OR (tipo = 'CONSUMO' AND cantidad_firmada < 0)
   OR (tipo IN ('AJUSTE','DEVOLUCION'))
 ),
 CONSTRAINT fk_mm_material FOREIGN KEY(id_material) REFERENCES materiales(id_material),
 CONSTRAINT fk_mm_detalle_compra FOREIGN KEY(id_detalle_compra) REFERENCES compra_detalles(id_detalle_compra),
 INDEX ix_mm_material_fecha(id_material,fecha),
 UNIQUE KEY uq_mm_detalle_compra (id_detalle_compra)
) ENGINE=InnoDB;

-- 3. PRODUCTOS Y RECETAS (BOM)
CREATE TABLE IF NOT EXISTS categorias (
 id_categoria SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(90) NOT NULL UNIQUE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS productos (
 id_producto BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_categoria SMALLINT UNSIGNED NOT NULL,
 sku VARCHAR(40) NOT NULL UNIQUE,
 nombre VARCHAR(160) NOT NULL,
 descripcion TEXT,
 precio_lista DECIMAL(12,2) NOT NULL,
 permite_grabado BOOLEAN NOT NULL DEFAULT TRUE,
 max_caracteres_grabado SMALLINT UNSIGNED NOT NULL DEFAULT 40,
 activo BOOLEAN NOT NULL DEFAULT TRUE,
 creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT chk_productos_precio CHECK(precio_lista >= 0),
 CONSTRAINT fk_productos_categoria FOREIGN KEY(id_categoria) REFERENCES categorias(id_categoria)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS imagenes_producto (
 id_imagen BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_producto BIGINT UNSIGNED NOT NULL,
 url VARCHAR(600) NOT NULL, orden SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 CONSTRAINT fk_imagen_producto FOREIGN KEY(id_producto) REFERENCES productos(id_producto),
 UNIQUE KEY uq_imagen_orden(id_producto,orden)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS recetas (
 id_receta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_producto BIGINT UNSIGNED NOT NULL,
 version SMALLINT UNSIGNED NOT NULL,
 vigente BOOLEAN NOT NULL DEFAULT FALSE,
 minutos_fabricacion SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 minutos_grabado SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 costo_hora_mano_obra DECIMAL(12,2) NOT NULL DEFAULT 0,
 costo_indirecto_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
 observaciones VARCHAR(300),
 CONSTRAINT uq_receta_producto_version UNIQUE(id_producto,version),
 CONSTRAINT chk_recetas_costos CHECK(costo_hora_mano_obra >= 0 AND costo_indirecto_unitario >= 0),
 CONSTRAINT fk_recetas_producto FOREIGN KEY(id_producto) REFERENCES productos(id_producto)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS receta_materiales (
 id_receta BIGINT UNSIGNED NOT NULL,
 id_material BIGINT UNSIGNED NOT NULL,
 cantidad DECIMAL(14,4) NOT NULL,
 PRIMARY KEY(id_receta,id_material),
 CONSTRAINT chk_rm_cantidad CHECK(cantidad > 0),
 CONSTRAINT fk_rm_receta FOREIGN KEY(id_receta) REFERENCES recetas(id_receta),
 CONSTRAINT fk_rm_material FOREIGN KEY(id_material) REFERENCES materiales(id_material)
) ENGINE=InnoDB;

-- 4. PEDIDOS Y PAGOS (se guardan precios HISTORICOS acordados)
CREATE TABLE IF NOT EXISTS pedidos (
 id_pedido BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 folio VARCHAR(35) NOT NULL UNIQUE,
 id_cliente BIGINT UNSIGNED NOT NULL,
 id_direccion BIGINT UNSIGNED NULL,
 fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 estado ENUM('PENDIENTE_ANTICIPO','CONFIRMADO','EN_PRODUCCION','LISTO','ENTREGADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE_ANTICIPO',
 modalidad_pago ENUM('ANTICIPO_50','TOTAL') NOT NULL,
 fecha_entrega_prometida DATETIME NULL,
 tipo_entrega ENUM('RECOLECCION','ENTREGA_LOCAL') NOT NULL DEFAULT 'RECOLECCION',
 monto_envio DECIMAL(12,2) NOT NULL DEFAULT 0,
 descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
 notas VARCHAR(500),
 CONSTRAINT chk_pedidos_envio CHECK(monto_envio >= 0 AND descuento >= 0),
 CONSTRAINT fk_pedidos_cliente FOREIGN KEY(id_cliente) REFERENCES usuarios(id_usuario),
 CONSTRAINT fk_pedidos_direccion FOREIGN KEY(id_direccion) REFERENCES direcciones(id_direccion),
 INDEX ix_pedidos_cliente_fecha(id_cliente,fecha),
 INDEX ix_pedidos_estado_fecha(estado,fecha)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS pedido_detalles (
 id_detalle_pedido BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_pedido BIGINT UNSIGNED NOT NULL,
 id_producto BIGINT UNSIGNED NOT NULL,
 cantidad INT UNSIGNED NOT NULL,
 precio_unitario_acordado DECIMAL(12,2) NOT NULL,
 texto_grabado VARCHAR(120) NULL,
 tipo_surtido ENUM('EXISTENCIA','FABRICACION') NOT NULL,
 notas VARCHAR(200),
 CONSTRAINT chk_pd_cantidad CHECK(cantidad > 0),
 CONSTRAINT chk_pd_precio CHECK(precio_unitario_acordado >= 0),
 CONSTRAINT fk_pd_pedido FOREIGN KEY(id_pedido) REFERENCES pedidos(id_pedido),
 CONSTRAINT fk_pd_producto FOREIGN KEY(id_producto) REFERENCES productos(id_producto),
 INDEX ix_pd_producto(id_producto)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS pagos (
 id_pago BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_pedido BIGINT UNSIGNED NOT NULL,
 fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 monto DECIMAL(12,2) NOT NULL,
 metodo ENUM('TARJETA_SIMULADA','TRANSFERENCIA_SIMULADA','EFECTIVO_SIMULADO') NOT NULL,
 estado ENUM('APROBADO_SIMULADO','RECHAZADO_SIMULADO','ANULADO') NOT NULL,
 referencia VARCHAR(80) NOT NULL UNIQUE,
 CONSTRAINT chk_pagos_monto CHECK(monto > 0),
 CONSTRAINT fk_pagos_pedido FOREIGN KEY(id_pedido) REFERENCES pedidos(id_pedido),
 INDEX ix_pago_pedido_estado(id_pedido,estado)
) ENGINE=InnoDB;

-- 5. PRODUCCION, CONSUMOS E INVENTARIO TERMINADO
CREATE TABLE IF NOT EXISTS ordenes_produccion (
 id_orden BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_receta BIGINT UNSIGNED NOT NULL,
 id_detalle_pedido BIGINT UNSIGNED NULL,
 cantidad INT UNSIGNED NOT NULL,
 estado ENUM('PLANIFICADA','EN_PROCESO','FINALIZADA','CANCELADA') NOT NULL DEFAULT 'PLANIFICADA',
 texto_grabado VARCHAR(120),
 fecha_inicio DATETIME NULL, fecha_fin DATETIME NULL,
 observaciones VARCHAR(300),
 CONSTRAINT chk_op_cantidad CHECK(cantidad > 0),
 CONSTRAINT fk_op_receta FOREIGN KEY(id_receta) REFERENCES recetas(id_receta),
 CONSTRAINT fk_op_detalle FOREIGN KEY(id_detalle_pedido) REFERENCES pedido_detalles(id_detalle_pedido),
 INDEX ix_op_estado(estado)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS consumos_produccion (
 id_consumo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_orden BIGINT UNSIGNED NOT NULL,
 id_material BIGINT UNSIGNED NOT NULL,
 cantidad DECIMAL(14,4) NOT NULL,
 costo_unitario_aplicado DECIMAL(14,4) NOT NULL,
 CONSTRAINT uq_consumo_orden_material UNIQUE(id_orden,id_material),
 CONSTRAINT chk_consumo_cantidad CHECK(cantidad > 0),
 CONSTRAINT chk_consumo_costo CHECK(costo_unitario_aplicado >= 0),
 CONSTRAINT fk_consumo_orden FOREIGN KEY(id_orden) REFERENCES ordenes_produccion(id_orden),
 CONSTRAINT fk_consumo_material FOREIGN KEY(id_material) REFERENCES materiales(id_material)
) ENGINE=InnoDB;
ALTER TABLE movimientos_material
 ADD CONSTRAINT fk_mm_orden FOREIGN KEY (id_orden_produccion) REFERENCES ordenes_produccion(id_orden),
 ADD UNIQUE KEY uq_mm_orden_material (id_orden_produccion,id_material);

-- Lotes distinguen producto GENERICO de producto grabado para un pedido.
CREATE TABLE IF NOT EXISTS lotes_producto (
 id_lote BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_producto BIGINT UNSIGNED NOT NULL,
 id_orden BIGINT UNSIGNED NULL UNIQUE,
 id_detalle_pedido BIGINT UNSIGNED NULL,
 texto_grabado VARCHAR(120),
 fecha_alta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_lote_producto FOREIGN KEY(id_producto) REFERENCES productos(id_producto),
 CONSTRAINT fk_lote_orden FOREIGN KEY(id_orden) REFERENCES ordenes_produccion(id_orden),
 CONSTRAINT fk_lote_detalle FOREIGN KEY(id_detalle_pedido) REFERENCES pedido_detalles(id_detalle_pedido),
 INDEX ix_lote_producto_personalizado(id_producto,id_detalle_pedido)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS movimientos_producto (
 id_movimiento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_lote BIGINT UNSIGNED NOT NULL,
 fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 tipo ENUM('PRODUCCION','ENTREGA','AJUSTE','DEVOLUCION') NOT NULL,
 cantidad_firmada INT NOT NULL,
 id_detalle_pedido BIGINT UNSIGNED NULL,
 observaciones VARCHAR(250),
 CONSTRAINT chk_mp_cantidad CHECK(cantidad_firmada <> 0),
 CONSTRAINT chk_mp_signo CHECK (
  (tipo = 'PRODUCCION' AND cantidad_firmada > 0)
  OR (tipo = 'ENTREGA' AND cantidad_firmada < 0)
  OR (tipo IN ('AJUSTE','DEVOLUCION'))
 ),
 CONSTRAINT fk_mp_lote FOREIGN KEY(id_lote) REFERENCES lotes_producto(id_lote),
 CONSTRAINT fk_mp_detalle FOREIGN KEY(id_detalle_pedido) REFERENCES pedido_detalles(id_detalle_pedido),
 INDEX ix_mp_lote_fecha(id_lote,fecha)
) ENGINE=InnoDB;
-- La reserva reduce el stock DISPONIBLE sin descontar existencia fisica.
CREATE TABLE IF NOT EXISTS reservas_producto (
 id_reserva BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_lote BIGINT UNSIGNED NOT NULL,
 id_detalle_pedido BIGINT UNSIGNED NOT NULL,
 cantidad INT UNSIGNED NOT NULL,
 estado ENUM('ACTIVA','CONSUMIDA','LIBERADA') NOT NULL DEFAULT 'ACTIVA',
 fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT chk_reserva_cantidad CHECK(cantidad > 0),
 CONSTRAINT fk_reserva_lote FOREIGN KEY(id_lote) REFERENCES lotes_producto(id_lote),
 CONSTRAINT fk_reserva_detalle FOREIGN KEY(id_detalle_pedido) REFERENCES pedido_detalles(id_detalle_pedido),
 UNIQUE KEY uq_reserva_lote_detalle(id_lote,id_detalle_pedido),
 INDEX ix_reserva_lote_estado(id_lote,estado)
) ENGINE=InnoDB;

-- 6. ENTREGA Y RESENAS
CREATE TABLE IF NOT EXISTS entregas (
 id_entrega BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_pedido BIGINT UNSIGNED NOT NULL UNIQUE,
 programada DATETIME NULL, entregada DATETIME NULL,
 estado ENUM('PENDIENTE','PROGRAMADA','ENTREGADA') NOT NULL DEFAULT 'PENDIENTE',
 receptor VARCHAR(120), observaciones VARCHAR(300),
 CONSTRAINT fk_entrega_pedido FOREIGN KEY(id_pedido) REFERENCES pedidos(id_pedido)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS resenas (
 id_resena BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_detalle_pedido BIGINT UNSIGNED NOT NULL UNIQUE,
 puntuacion TINYINT UNSIGNED NOT NULL, comentario VARCHAR(1000),
 fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT chk_resena_puntuacion CHECK(puntuacion BETWEEN 1 AND 5),
 CONSTRAINT fk_resena_detalle FOREIGN KEY(id_detalle_pedido) REFERENCES pedido_detalles(id_detalle_pedido)
) ENGINE=InnoDB;

-- 7. VISTAS OPERATIVAS PARA INVENTARIOS, SALDOS Y DASHBOARD OBLIGATORIO
CREATE OR REPLACE VIEW vw_stock_materiales AS
 SELECT m.id_material,m.sku,m.nombre,u.codigo AS unidad,m.stock_minimo,
  COALESCE(SUM(mm.cantidad_firmada),0) AS stock_actual
 FROM materiales m
 JOIN unidades_medida u ON u.id_unidad=m.id_unidad
 LEFT JOIN movimientos_material mm ON mm.id_material=m.id_material
 GROUP BY m.id_material,m.sku,m.nombre,u.codigo,m.stock_minimo;

CREATE OR REPLACE VIEW vw_stock_lotes AS
 SELECT l.id_lote,l.id_producto,p.sku,p.nombre,l.id_detalle_pedido,l.texto_grabado,
  COALESCE(mp.existencia,0) AS existencia,
  COALESCE(r.reservado,0) AS reservado,
  COALESCE(mp.existencia,0)-COALESCE(r.reservado,0) AS disponible
 FROM lotes_producto l JOIN productos p ON p.id_producto=l.id_producto
 LEFT JOIN (SELECT id_lote,SUM(cantidad_firmada) AS existencia
            FROM movimientos_producto GROUP BY id_lote) mp ON mp.id_lote=l.id_lote
 LEFT JOIN (SELECT id_lote,SUM(cantidad) AS reservado
            FROM reservas_producto WHERE estado='ACTIVA' GROUP BY id_lote) r ON r.id_lote=l.id_lote;

CREATE OR REPLACE VIEW vw_stock_productos AS
 SELECT p.id_producto,p.sku,p.nombre,
  COALESCE(SUM(v.existencia),0) AS existencia,
  COALESCE(SUM(v.reservado),0) AS reservado,
  COALESCE(SUM(v.disponible),0) AS disponible
 FROM productos p LEFT JOIN vw_stock_lotes v ON v.id_producto=p.id_producto
 GROUP BY p.id_producto,p.sku,p.nombre;

CREATE OR REPLACE VIEW vw_saldos_pedidos AS
 SELECT p.id_pedido,p.folio,p.id_cliente,p.estado,p.modalidad_pago,
  COALESCE(d.subtotal,0) AS subtotal,
  p.monto_envio,p.descuento,
  GREATEST(0,COALESCE(d.subtotal,0)+p.monto_envio-p.descuento) AS total,
  COALESCE(pg.pagado,0) AS pagado,
  GREATEST(0,COALESCE(d.subtotal,0)+p.monto_envio-p.descuento-COALESCE(pg.pagado,0)) AS saldo
 FROM pedidos p
 LEFT JOIN (SELECT id_pedido,SUM(cantidad*precio_unitario_acordado) AS subtotal
            FROM pedido_detalles GROUP BY id_pedido) d ON d.id_pedido=p.id_pedido
 LEFT JOIN (SELECT id_pedido,SUM(monto) AS pagado
            FROM pagos WHERE estado='APROBADO_SIMULADO' GROUP BY id_pedido) pg ON pg.id_pedido=p.id_pedido;
