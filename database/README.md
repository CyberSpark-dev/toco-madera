# Base de datos de Toco Madera v2.0.0

MySQL 8 aloja el esquema relacional. Flask se conecta mediante PyMySQL y SQLAlchemy con `DATABASE_URL`, definida en el archivo privado `backend/.env`.

## Instalación limpia

Prepara una instancia vacía destinada al proyecto. Revisa los scripts antes de ejecutarlos. Varios contienen el nombre literal `toco_madera`; verifica el servidor y el destino en la sesión MySQL.

1. `01_schema.sql` crea el esquema, las tablas y las vistas de base.
2. `01_punto_recoleccion.sql` añade una vez el punto de recolección a `entregas`.
3. `01_autorizaciones_pedido.sql` agrega el registro de decisiones del taller.
4. `02_seed.sql` carga el catálogo y las referencias demostrativas de una instalación nueva. Ejecútalo una sola vez.
5. `migrations/20261125_01_compras_asistidas.sql` amplía compras y detalles. Verifica que sus columnas aún no existan. Para un esquema existente consulta el [procedimiento protegido](../docs/COMPRAS-ASISTIDAS-PRUEBAS.md).

Las referencias de tipografías seleccionables y devoluciones quedan fuera del despliegue. El grabado usa el campo original de texto. La cancelación cambia el estado del pedido y conserva los pagos.

## Unidades y precisión

La unidad base reside en `materiales.id_unidad`. Para una cotización se registra cuánta unidad base contiene una presentación. Compras asistidas acepta cotizaciones MXN clasificadas como cotizadas, del proveedor y material seleccionados, cuando el precio se puede expresar exactamente con el costo unitario disponible. El número de presentaciones es entero. La recepción registra la cantidad resultante en unidad base.

MySQL conserva cantidades físicas y costos unitarios de materiales con cuatro decimales. Los precios de catálogo, precios acordados, precios por presentación y montos de pago usan dos decimales. La visualización a centavos no reescribe el costo original.

La auditoría de cierre en solo lectura detectó fracciones históricas en `PZA`, seis renglones de receta y seis movimientos, así como siete costos unitarios de compra con más de dos decimales significativos. Esos valores se preservaron.

## Respaldo y pruebas

Guarda los respaldos y las credenciales fuera del repositorio. Verifica huellas, objetos y registros con una restauración aislada antes de usar un respaldo para recuperación. El volcado v1.0 es una referencia histórica que debe revisarse antes de cualquier publicación o uso. Las pruebas con escrituras comprueban el UUID, puerto, esquema y directorio del destino aislado. Consulta la [guía de pruebas](../docs/COMPRAS-ASISTIDAS-PRUEBAS.md).
