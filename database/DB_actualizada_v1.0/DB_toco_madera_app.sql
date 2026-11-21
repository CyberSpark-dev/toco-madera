CREATE DATABASE  IF NOT EXISTS `toco_madera` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `toco_madera`;
-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: toco_madera
-- ------------------------------------------------------
-- Server version	8.4.8

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `autorizaciones_pedido`
--

DROP TABLE IF EXISTS `autorizaciones_pedido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `autorizaciones_pedido` (
  `id_pedido` bigint unsigned NOT NULL,
  `estado` enum('APROBADO','RECHAZADO') NOT NULL,
  `id_admin` bigint unsigned NOT NULL,
  `motivo` varchar(300) DEFAULT NULL,
  `fecha_decision` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_pedido`),
  KEY `ix_autorizaciones_admin` (`id_admin`),
  CONSTRAINT `fk_autorizaciones_admin` FOREIGN KEY (`id_admin`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_autorizaciones_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedidos` (`id_pedido`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categorias` (
  `id_categoria` smallint unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(90) NOT NULL,
  PRIMARY KEY (`id_categoria`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `compra_detalles`
--

DROP TABLE IF EXISTS `compra_detalles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compra_detalles` (
  `id_detalle_compra` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_compra` bigint unsigned NOT NULL,
  `id_material` bigint unsigned NOT NULL,
  `cantidad` decimal(14,4) NOT NULL,
  `costo_unitario` decimal(14,4) NOT NULL,
  PRIMARY KEY (`id_detalle_compra`),
  KEY `fk_cd_compra` (`id_compra`),
  KEY `ix_cd_material` (`id_material`),
  CONSTRAINT `fk_cd_compra` FOREIGN KEY (`id_compra`) REFERENCES `compras` (`id_compra`),
  CONSTRAINT `fk_cd_material` FOREIGN KEY (`id_material`) REFERENCES `materiales` (`id_material`),
  CONSTRAINT `chk_cd_cantidad` CHECK ((`cantidad` > 0)),
  CONSTRAINT `chk_cd_costo` CHECK ((`costo_unitario` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `compras`
--

DROP TABLE IF EXISTS `compras`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compras` (
  `id_compra` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_proveedor` bigint unsigned NOT NULL,
  `id_usuario_registro` bigint unsigned DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('BORRADOR','RECIBIDA','CANCELADA') NOT NULL DEFAULT 'BORRADOR',
  `referencia_documento` varchar(90) DEFAULT NULL,
  `observaciones` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id_compra`),
  KEY `fk_compras_proveedor` (`id_proveedor`),
  KEY `fk_compras_usuario` (`id_usuario_registro`),
  KEY `ix_compra_estado_fecha` (`estado`,`fecha`),
  CONSTRAINT `fk_compras_proveedor` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id_proveedor`),
  CONSTRAINT `fk_compras_usuario` FOREIGN KEY (`id_usuario_registro`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `consumos_produccion`
--

DROP TABLE IF EXISTS `consumos_produccion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consumos_produccion` (
  `id_consumo` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_orden` bigint unsigned NOT NULL,
  `id_material` bigint unsigned NOT NULL,
  `cantidad` decimal(14,4) NOT NULL,
  `costo_unitario_aplicado` decimal(14,4) NOT NULL,
  PRIMARY KEY (`id_consumo`),
  UNIQUE KEY `uq_consumo_orden_material` (`id_orden`,`id_material`),
  KEY `fk_consumo_material` (`id_material`),
  CONSTRAINT `fk_consumo_material` FOREIGN KEY (`id_material`) REFERENCES `materiales` (`id_material`),
  CONSTRAINT `fk_consumo_orden` FOREIGN KEY (`id_orden`) REFERENCES `ordenes_produccion` (`id_orden`),
  CONSTRAINT `chk_consumo_cantidad` CHECK ((`cantidad` > 0)),
  CONSTRAINT `chk_consumo_costo` CHECK ((`costo_unitario_aplicado` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cotizaciones_material`
--

DROP TABLE IF EXISTS `cotizaciones_material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cotizaciones_material` (
  `id_cotizacion` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_material` bigint unsigned NOT NULL,
  `id_proveedor` bigint unsigned DEFAULT NULL,
  `fecha` date NOT NULL,
  `presentacion` varchar(160) NOT NULL,
  `cantidad_base` decimal(14,4) NOT NULL,
  `precio_presentacion` decimal(13,2) NOT NULL,
  `moneda` char(3) NOT NULL DEFAULT 'MXN',
  `clasificacion` enum('PUBLICADA','COTIZADA','ESTIMADA') NOT NULL,
  `url_fuente` varchar(700) DEFAULT NULL,
  `observaciones` varchar(250) DEFAULT NULL,
  PRIMARY KEY (`id_cotizacion`),
  KEY `fk_cot_proveedor` (`id_proveedor`),
  KEY `ix_cot_material_fecha` (`id_material`,`fecha`),
  CONSTRAINT `fk_cot_material` FOREIGN KEY (`id_material`) REFERENCES `materiales` (`id_material`),
  CONSTRAINT `fk_cot_proveedor` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id_proveedor`),
  CONSTRAINT `chk_cot_cantidad` CHECK ((`cantidad_base` > 0)),
  CONSTRAINT `chk_cot_precio` CHECK ((`precio_presentacion` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `direcciones`
--

DROP TABLE IF EXISTS `direcciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `direcciones` (
  `id_direccion` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` bigint unsigned NOT NULL,
  `etiqueta` varchar(40) NOT NULL DEFAULT 'Principal',
  `calle` varchar(150) NOT NULL,
  `numero` varchar(20) DEFAULT NULL,
  `colonia` varchar(120) DEFAULT NULL,
  `ciudad` varchar(100) NOT NULL,
  `estado` varchar(100) NOT NULL,
  `codigo_postal` varchar(10) DEFAULT NULL,
  `referencia` varchar(250) DEFAULT NULL,
  PRIMARY KEY (`id_direccion`),
  KEY `fk_direcciones_usuario` (`id_usuario`),
  CONSTRAINT `fk_direcciones_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entregas`
--

DROP TABLE IF EXISTS `entregas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entregas` (
  `id_entrega` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_pedido` bigint unsigned NOT NULL,
  `programada` datetime DEFAULT NULL,
  `entregada` datetime DEFAULT NULL,
  `estado` enum('PENDIENTE','PROGRAMADA','ENTREGADA') NOT NULL DEFAULT 'PENDIENTE',
  `receptor` varchar(120) DEFAULT NULL,
  `observaciones` varchar(300) DEFAULT NULL,
  `punto_recoleccion` varchar(200) DEFAULT NULL COMMENT 'Lugar acordado con el cliente; no inventar direcciones',
  PRIMARY KEY (`id_entrega`),
  UNIQUE KEY `id_pedido` (`id_pedido`),
  CONSTRAINT `fk_entrega_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedidos` (`id_pedido`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `imagenes_producto`
--

DROP TABLE IF EXISTS `imagenes_producto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `imagenes_producto` (
  `id_imagen` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_producto` bigint unsigned NOT NULL,
  `url` varchar(600) NOT NULL,
  `orden` smallint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id_imagen`),
  UNIQUE KEY `uq_imagen_orden` (`id_producto`,`orden`),
  CONSTRAINT `fk_imagen_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lotes_producto`
--

DROP TABLE IF EXISTS `lotes_producto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lotes_producto` (
  `id_lote` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_producto` bigint unsigned NOT NULL,
  `id_orden` bigint unsigned DEFAULT NULL,
  `id_detalle_pedido` bigint unsigned DEFAULT NULL,
  `texto_grabado` varchar(120) DEFAULT NULL,
  `fecha_alta` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_lote`),
  UNIQUE KEY `id_orden` (`id_orden`),
  KEY `fk_lote_detalle` (`id_detalle_pedido`),
  KEY `ix_lote_producto_personalizado` (`id_producto`,`id_detalle_pedido`),
  CONSTRAINT `fk_lote_detalle` FOREIGN KEY (`id_detalle_pedido`) REFERENCES `pedido_detalles` (`id_detalle_pedido`),
  CONSTRAINT `fk_lote_orden` FOREIGN KEY (`id_orden`) REFERENCES `ordenes_produccion` (`id_orden`),
  CONSTRAINT `fk_lote_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `materiales`
--

DROP TABLE IF EXISTS `materiales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `materiales` (
  `id_material` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sku` varchar(40) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` varchar(250) DEFAULT NULL,
  `id_unidad` smallint unsigned NOT NULL,
  `stock_minimo` decimal(14,4) NOT NULL DEFAULT '0.0000',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `costo_base` decimal(14,4) DEFAULT NULL COMMENT 'Costo unitario de referencia MXN por unidad_medida; editable; no cambia costo historico de compras',
  PRIMARY KEY (`id_material`),
  UNIQUE KEY `sku` (`sku`),
  KEY `fk_materiales_unidad` (`id_unidad`),
  CONSTRAINT `fk_materiales_unidad` FOREIGN KEY (`id_unidad`) REFERENCES `unidades_medida` (`id_unidad`),
  CONSTRAINT `chk_materiales_minimo` CHECK ((`stock_minimo` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `movimientos_material`
--

DROP TABLE IF EXISTS `movimientos_material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `movimientos_material` (
  `id_movimiento` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_material` bigint unsigned NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tipo` enum('COMPRA','CONSUMO','AJUSTE','DEVOLUCION') NOT NULL,
  `cantidad_firmada` decimal(14,4) NOT NULL,
  `costo_unitario_aplicado` decimal(14,4) DEFAULT NULL,
  `id_detalle_compra` bigint unsigned DEFAULT NULL,
  `id_orden_produccion` bigint unsigned DEFAULT NULL,
  `observaciones` varchar(250) DEFAULT NULL,
  PRIMARY KEY (`id_movimiento`),
  UNIQUE KEY `uq_mm_detalle_compra` (`id_detalle_compra`),
  UNIQUE KEY `uq_mm_orden_material` (`id_orden_produccion`,`id_material`),
  KEY `ix_mm_material_fecha` (`id_material`,`fecha`),
  CONSTRAINT `fk_mm_detalle_compra` FOREIGN KEY (`id_detalle_compra`) REFERENCES `compra_detalles` (`id_detalle_compra`),
  CONSTRAINT `fk_mm_material` FOREIGN KEY (`id_material`) REFERENCES `materiales` (`id_material`),
  CONSTRAINT `fk_mm_orden` FOREIGN KEY (`id_orden_produccion`) REFERENCES `ordenes_produccion` (`id_orden`),
  CONSTRAINT `chk_mm_cantidad` CHECK ((`cantidad_firmada` <> 0)),
  CONSTRAINT `chk_mm_costo` CHECK (((`costo_unitario_aplicado` is null) or (`costo_unitario_aplicado` >= 0))),
  CONSTRAINT `chk_mm_tipo_signo` CHECK ((((`tipo` = _utf8mb4'COMPRA') and (`cantidad_firmada` > 0)) or ((`tipo` = _utf8mb4'CONSUMO') and (`cantidad_firmada` < 0)) or (`tipo` in (_utf8mb4'AJUSTE',_utf8mb4'DEVOLUCION'))))
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `movimientos_producto`
--

DROP TABLE IF EXISTS `movimientos_producto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `movimientos_producto` (
  `id_movimiento` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_lote` bigint unsigned NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tipo` enum('PRODUCCION','ENTREGA','AJUSTE','DEVOLUCION') NOT NULL,
  `cantidad_firmada` int NOT NULL,
  `id_detalle_pedido` bigint unsigned DEFAULT NULL,
  `observaciones` varchar(250) DEFAULT NULL,
  PRIMARY KEY (`id_movimiento`),
  KEY `fk_mp_detalle` (`id_detalle_pedido`),
  KEY `ix_mp_lote_fecha` (`id_lote`,`fecha`),
  CONSTRAINT `fk_mp_detalle` FOREIGN KEY (`id_detalle_pedido`) REFERENCES `pedido_detalles` (`id_detalle_pedido`),
  CONSTRAINT `fk_mp_lote` FOREIGN KEY (`id_lote`) REFERENCES `lotes_producto` (`id_lote`),
  CONSTRAINT `chk_mp_cantidad` CHECK ((`cantidad_firmada` <> 0)),
  CONSTRAINT `chk_mp_signo` CHECK ((((`tipo` = _utf8mb4'PRODUCCION') and (`cantidad_firmada` > 0)) or ((`tipo` = _utf8mb4'ENTREGA') and (`cantidad_firmada` < 0)) or (`tipo` in (_utf8mb4'AJUSTE',_utf8mb4'DEVOLUCION'))))
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ordenes_produccion`
--

DROP TABLE IF EXISTS `ordenes_produccion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ordenes_produccion` (
  `id_orden` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_receta` bigint unsigned NOT NULL,
  `id_detalle_pedido` bigint unsigned DEFAULT NULL,
  `cantidad` int unsigned NOT NULL,
  `estado` enum('PLANIFICADA','EN_PROCESO','FINALIZADA','CANCELADA') NOT NULL DEFAULT 'PLANIFICADA',
  `texto_grabado` varchar(120) DEFAULT NULL,
  `fecha_inicio` datetime DEFAULT NULL,
  `fecha_fin` datetime DEFAULT NULL,
  `observaciones` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id_orden`),
  KEY `fk_op_receta` (`id_receta`),
  KEY `fk_op_detalle` (`id_detalle_pedido`),
  KEY `ix_op_estado` (`estado`),
  CONSTRAINT `fk_op_detalle` FOREIGN KEY (`id_detalle_pedido`) REFERENCES `pedido_detalles` (`id_detalle_pedido`),
  CONSTRAINT `fk_op_receta` FOREIGN KEY (`id_receta`) REFERENCES `recetas` (`id_receta`),
  CONSTRAINT `chk_op_cantidad` CHECK ((`cantidad` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pagos`
--

DROP TABLE IF EXISTS `pagos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pagos` (
  `id_pago` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_pedido` bigint unsigned NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `monto` decimal(12,2) NOT NULL,
  `metodo` enum('TARJETA_SIMULADA','TRANSFERENCIA_SIMULADA','EFECTIVO_SIMULADO') NOT NULL,
  `estado` enum('APROBADO_SIMULADO','RECHAZADO_SIMULADO','ANULADO') NOT NULL,
  `referencia` varchar(80) NOT NULL,
  PRIMARY KEY (`id_pago`),
  UNIQUE KEY `referencia` (`referencia`),
  KEY `ix_pago_pedido_estado` (`id_pedido`,`estado`),
  CONSTRAINT `fk_pagos_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedidos` (`id_pedido`),
  CONSTRAINT `chk_pagos_monto` CHECK ((`monto` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pedido_detalles`
--

DROP TABLE IF EXISTS `pedido_detalles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pedido_detalles` (
  `id_detalle_pedido` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_pedido` bigint unsigned NOT NULL,
  `id_producto` bigint unsigned NOT NULL,
  `cantidad` int unsigned NOT NULL,
  `precio_unitario_acordado` decimal(12,2) NOT NULL,
  `texto_grabado` varchar(120) DEFAULT NULL,
  `tipo_surtido` enum('EXISTENCIA','FABRICACION') NOT NULL,
  `notas` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id_detalle_pedido`),
  KEY `fk_pd_pedido` (`id_pedido`),
  KEY `ix_pd_producto` (`id_producto`),
  CONSTRAINT `fk_pd_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedidos` (`id_pedido`),
  CONSTRAINT `fk_pd_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`),
  CONSTRAINT `chk_pd_cantidad` CHECK ((`cantidad` > 0)),
  CONSTRAINT `chk_pd_precio` CHECK ((`precio_unitario_acordado` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pedidos`
--

DROP TABLE IF EXISTS `pedidos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pedidos` (
  `id_pedido` bigint unsigned NOT NULL AUTO_INCREMENT,
  `folio` varchar(35) NOT NULL,
  `id_cliente` bigint unsigned NOT NULL,
  `id_direccion` bigint unsigned DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('PENDIENTE_ANTICIPO','CONFIRMADO','EN_PRODUCCION','LISTO','ENTREGADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE_ANTICIPO',
  `modalidad_pago` enum('ANTICIPO_50','TOTAL') NOT NULL,
  `fecha_entrega_prometida` datetime DEFAULT NULL,
  `tipo_entrega` enum('RECOLECCION','ENTREGA_LOCAL') NOT NULL DEFAULT 'RECOLECCION',
  `monto_envio` decimal(12,2) NOT NULL DEFAULT '0.00',
  `descuento` decimal(12,2) NOT NULL DEFAULT '0.00',
  `notas` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id_pedido`),
  UNIQUE KEY `folio` (`folio`),
  KEY `fk_pedidos_direccion` (`id_direccion`),
  KEY `ix_pedidos_cliente_fecha` (`id_cliente`,`fecha`),
  KEY `ix_pedidos_estado_fecha` (`estado`,`fecha`),
  CONSTRAINT `fk_pedidos_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_pedidos_direccion` FOREIGN KEY (`id_direccion`) REFERENCES `direcciones` (`id_direccion`),
  CONSTRAINT `chk_pedidos_envio` CHECK (((`monto_envio` >= 0) and (`descuento` >= 0)))
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `productos`
--

DROP TABLE IF EXISTS `productos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productos` (
  `id_producto` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_categoria` smallint unsigned NOT NULL,
  `sku` varchar(40) NOT NULL,
  `nombre` varchar(160) NOT NULL,
  `descripcion` text,
  `precio_lista` decimal(12,2) NOT NULL,
  `permite_grabado` tinyint(1) NOT NULL DEFAULT '1',
  `max_caracteres_grabado` smallint unsigned NOT NULL DEFAULT '40',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_producto`),
  UNIQUE KEY `sku` (`sku`),
  KEY `fk_productos_categoria` (`id_categoria`),
  CONSTRAINT `fk_productos_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categorias` (`id_categoria`),
  CONSTRAINT `chk_productos_precio` CHECK ((`precio_lista` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `proveedores`
--

DROP TABLE IF EXISTS `proveedores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `proveedores` (
  `id_proveedor` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(160) NOT NULL,
  `contacto` varchar(120) DEFAULT NULL,
  `telefono` varchar(25) DEFAULT NULL,
  `correo` varchar(190) DEFAULT NULL,
  `direccion` varchar(250) DEFAULT NULL,
  `sitio_web` varchar(500) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_proveedor`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `receta_materiales`
--

DROP TABLE IF EXISTS `receta_materiales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `receta_materiales` (
  `id_receta` bigint unsigned NOT NULL,
  `id_material` bigint unsigned NOT NULL,
  `cantidad` decimal(14,4) NOT NULL,
  PRIMARY KEY (`id_receta`,`id_material`),
  KEY `fk_rm_material` (`id_material`),
  CONSTRAINT `fk_rm_material` FOREIGN KEY (`id_material`) REFERENCES `materiales` (`id_material`),
  CONSTRAINT `fk_rm_receta` FOREIGN KEY (`id_receta`) REFERENCES `recetas` (`id_receta`),
  CONSTRAINT `chk_rm_cantidad` CHECK ((`cantidad` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recetas`
--

DROP TABLE IF EXISTS `recetas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recetas` (
  `id_receta` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_producto` bigint unsigned NOT NULL,
  `version` smallint unsigned NOT NULL,
  `vigente` tinyint(1) NOT NULL DEFAULT '0',
  `minutos_fabricacion` smallint unsigned NOT NULL DEFAULT '0',
  `minutos_grabado` smallint unsigned NOT NULL DEFAULT '0',
  `costo_hora_mano_obra` decimal(12,2) NOT NULL DEFAULT '0.00',
  `costo_indirecto_unitario` decimal(12,2) NOT NULL DEFAULT '0.00',
  `observaciones` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id_receta`),
  UNIQUE KEY `uq_receta_producto_version` (`id_producto`,`version`),
  CONSTRAINT `fk_recetas_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`),
  CONSTRAINT `chk_recetas_costos` CHECK (((`costo_hora_mano_obra` >= 0) and (`costo_indirecto_unitario` >= 0)))
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `resenas`
--

DROP TABLE IF EXISTS `resenas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `resenas` (
  `id_resena` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_detalle_pedido` bigint unsigned NOT NULL,
  `puntuacion` tinyint unsigned NOT NULL,
  `comentario` varchar(1000) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_resena`),
  UNIQUE KEY `id_detalle_pedido` (`id_detalle_pedido`),
  CONSTRAINT `fk_resena_detalle` FOREIGN KEY (`id_detalle_pedido`) REFERENCES `pedido_detalles` (`id_detalle_pedido`),
  CONSTRAINT `chk_resena_puntuacion` CHECK ((`puntuacion` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reservas_producto`
--

DROP TABLE IF EXISTS `reservas_producto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reservas_producto` (
  `id_reserva` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_lote` bigint unsigned NOT NULL,
  `id_detalle_pedido` bigint unsigned NOT NULL,
  `cantidad` int unsigned NOT NULL,
  `estado` enum('ACTIVA','CONSUMIDA','LIBERADA') NOT NULL DEFAULT 'ACTIVA',
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_reserva`),
  UNIQUE KEY `uq_reserva_lote_detalle` (`id_lote`,`id_detalle_pedido`),
  KEY `fk_reserva_detalle` (`id_detalle_pedido`),
  KEY `ix_reserva_lote_estado` (`id_lote`,`estado`),
  CONSTRAINT `fk_reserva_detalle` FOREIGN KEY (`id_detalle_pedido`) REFERENCES `pedido_detalles` (`id_detalle_pedido`),
  CONSTRAINT `fk_reserva_lote` FOREIGN KEY (`id_lote`) REFERENCES `lotes_producto` (`id_lote`),
  CONSTRAINT `chk_reserva_cantidad` CHECK ((`cantidad` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id_rol` tinyint unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(30) NOT NULL,
  `descripcion` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id_rol`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `unidades_medida`
--

DROP TABLE IF EXISTS `unidades_medida`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `unidades_medida` (
  `id_unidad` smallint unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(12) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id_unidad`),
  UNIQUE KEY `codigo` (`codigo`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id_usuario` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_rol` tinyint unsigned NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `correo` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `telefono` varchar(25) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `correo` (`correo`),
  KEY `fk_usuarios_roles` (`id_rol`),
  CONSTRAINT `fk_usuarios_roles` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `vw_saldos_pedidos`
--

DROP TABLE IF EXISTS `vw_saldos_pedidos`;
/*!50001 DROP VIEW IF EXISTS `vw_saldos_pedidos`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vw_saldos_pedidos` AS SELECT 
 1 AS `id_pedido`,
 1 AS `folio`,
 1 AS `id_cliente`,
 1 AS `estado`,
 1 AS `modalidad_pago`,
 1 AS `subtotal`,
 1 AS `monto_envio`,
 1 AS `descuento`,
 1 AS `total`,
 1 AS `pagado`,
 1 AS `saldo`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vw_stock_lotes`
--

DROP TABLE IF EXISTS `vw_stock_lotes`;
/*!50001 DROP VIEW IF EXISTS `vw_stock_lotes`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vw_stock_lotes` AS SELECT 
 1 AS `id_lote`,
 1 AS `id_producto`,
 1 AS `sku`,
 1 AS `nombre`,
 1 AS `id_detalle_pedido`,
 1 AS `texto_grabado`,
 1 AS `existencia`,
 1 AS `reservado`,
 1 AS `disponible`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vw_stock_materiales`
--

DROP TABLE IF EXISTS `vw_stock_materiales`;
/*!50001 DROP VIEW IF EXISTS `vw_stock_materiales`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vw_stock_materiales` AS SELECT 
 1 AS `id_material`,
 1 AS `sku`,
 1 AS `nombre`,
 1 AS `unidad`,
 1 AS `stock_minimo`,
 1 AS `stock_actual`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vw_stock_productos`
--

DROP TABLE IF EXISTS `vw_stock_productos`;
/*!50001 DROP VIEW IF EXISTS `vw_stock_productos`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vw_stock_productos` AS SELECT 
 1 AS `id_producto`,
 1 AS `sku`,
 1 AS `nombre`,
 1 AS `existencia`,
 1 AS `reservado`,
 1 AS `disponible`*/;
SET character_set_client = @saved_cs_client;

--
-- Dumping events for database 'toco_madera'
--

--
-- Dumping routines for database 'toco_madera'
--

--
-- Final view structure for view `vw_saldos_pedidos`
--

/*!50001 DROP VIEW IF EXISTS `vw_saldos_pedidos`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_saldos_pedidos` AS select `p`.`id_pedido` AS `id_pedido`,`p`.`folio` AS `folio`,`p`.`id_cliente` AS `id_cliente`,`p`.`estado` AS `estado`,`p`.`modalidad_pago` AS `modalidad_pago`,coalesce(`d`.`subtotal`,0) AS `subtotal`,`p`.`monto_envio` AS `monto_envio`,`p`.`descuento` AS `descuento`,greatest(0,((coalesce(`d`.`subtotal`,0) + `p`.`monto_envio`) - `p`.`descuento`)) AS `total`,coalesce(`pg`.`pagado`,0) AS `pagado`,greatest(0,(((coalesce(`d`.`subtotal`,0) + `p`.`monto_envio`) - `p`.`descuento`) - coalesce(`pg`.`pagado`,0))) AS `saldo` from ((`pedidos` `p` left join (select `pedido_detalles`.`id_pedido` AS `id_pedido`,sum((`pedido_detalles`.`cantidad` * `pedido_detalles`.`precio_unitario_acordado`)) AS `subtotal` from `pedido_detalles` group by `pedido_detalles`.`id_pedido`) `d` on((`d`.`id_pedido` = `p`.`id_pedido`))) left join (select `pagos`.`id_pedido` AS `id_pedido`,sum(`pagos`.`monto`) AS `pagado` from `pagos` where (`pagos`.`estado` = 'APROBADO_SIMULADO') group by `pagos`.`id_pedido`) `pg` on((`pg`.`id_pedido` = `p`.`id_pedido`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vw_stock_lotes`
--

/*!50001 DROP VIEW IF EXISTS `vw_stock_lotes`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_stock_lotes` AS select `l`.`id_lote` AS `id_lote`,`l`.`id_producto` AS `id_producto`,`p`.`sku` AS `sku`,`p`.`nombre` AS `nombre`,`l`.`id_detalle_pedido` AS `id_detalle_pedido`,`l`.`texto_grabado` AS `texto_grabado`,coalesce(`mp`.`existencia`,0) AS `existencia`,coalesce(`r`.`reservado`,0) AS `reservado`,(coalesce(`mp`.`existencia`,0) - coalesce(`r`.`reservado`,0)) AS `disponible` from (((`lotes_producto` `l` join `productos` `p` on((`p`.`id_producto` = `l`.`id_producto`))) left join (select `movimientos_producto`.`id_lote` AS `id_lote`,sum(`movimientos_producto`.`cantidad_firmada`) AS `existencia` from `movimientos_producto` group by `movimientos_producto`.`id_lote`) `mp` on((`mp`.`id_lote` = `l`.`id_lote`))) left join (select `reservas_producto`.`id_lote` AS `id_lote`,sum(`reservas_producto`.`cantidad`) AS `reservado` from `reservas_producto` where (`reservas_producto`.`estado` = 'ACTIVA') group by `reservas_producto`.`id_lote`) `r` on((`r`.`id_lote` = `l`.`id_lote`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vw_stock_materiales`
--

/*!50001 DROP VIEW IF EXISTS `vw_stock_materiales`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_stock_materiales` AS select `m`.`id_material` AS `id_material`,`m`.`sku` AS `sku`,`m`.`nombre` AS `nombre`,`u`.`codigo` AS `unidad`,`m`.`stock_minimo` AS `stock_minimo`,coalesce(sum(`mm`.`cantidad_firmada`),0) AS `stock_actual` from ((`materiales` `m` join `unidades_medida` `u` on((`u`.`id_unidad` = `m`.`id_unidad`))) left join `movimientos_material` `mm` on((`mm`.`id_material` = `m`.`id_material`))) group by `m`.`id_material`,`m`.`sku`,`m`.`nombre`,`u`.`codigo`,`m`.`stock_minimo` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vw_stock_productos`
--

/*!50001 DROP VIEW IF EXISTS `vw_stock_productos`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_stock_productos` AS select `p`.`id_producto` AS `id_producto`,`p`.`sku` AS `sku`,`p`.`nombre` AS `nombre`,coalesce(sum(`v`.`existencia`),0) AS `existencia`,coalesce(sum(`v`.`reservado`),0) AS `reservado`,coalesce(sum(`v`.`disponible`),0) AS `disponible` from (`productos` `p` left join `vw_stock_lotes` `v` on((`v`.`id_producto` = `p`.`id_producto`))) group by `p`.`id_producto`,`p`.`sku`,`p`.`nombre` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-21 12:56:49
