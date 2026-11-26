-- Ampliación compatible. No actualiza compras históricas ni movimientos.
ALTER TABLE compras
  ADD COLUMN id_orden_produccion BIGINT UNSIGNED NULL,
  ADD COLUMN clave_solicitud CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN huella_solicitud CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN revision INT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_compras_orden_asistida FOREIGN KEY (id_orden_produccion)
    REFERENCES ordenes_produccion (id_orden),
  ADD UNIQUE KEY uq_compras_clave_solicitud (clave_solicitud),
  ADD KEY ix_compras_orden_estado_proveedor (id_orden_produccion, estado, id_proveedor);

ALTER TABLE compra_detalles
  ADD COLUMN id_cotizacion BIGINT UNSIGNED NULL,
  ADD COLUMN presentacion_aplicada VARCHAR(160) NULL,
  ADD COLUMN unidad_base_aplicada VARCHAR(100) NULL,
  ADD COLUMN cantidad_presentaciones INT UNSIGNED NULL,
  ADD COLUMN factor_presentacion DECIMAL(14,4) NULL,
  ADD COLUMN precio_presentacion_aplicado DECIMAL(13,2) NULL;
