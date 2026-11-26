# Respaldo aislado para compras asistidas

La base principal se identifica por esquema `toco_madera`, puerto local `3306`, MySQL `8.4.8` y UUID `75d9b091-3239-11f1-9208-60cf84707dee`. El destino es `toco_madera_compras_pruebas` en `127.0.0.1:33317`, con un directorio de datos nuevo y un UUID distinto. El script no elige una etapa por omisión ni usa las credenciales de Flask.

## Credencial de respaldo y validación

En un archivo privado UTF-8 fuera del repositorio, por ejemplo `%LOCALAPPDATA%\TocoMadera\mysql-backup.env`, guarda una sola entrada:

```dotenv
DATABASE_URL=mysql+pymysql://USUARIO:CLAVE_CODIFICADA@localhost:3306/toco_madera
```

Codifica los caracteres reservados del usuario y contraseña como componentes URL. Desde la raíz del repositorio, configura la ruta en la sesión actual. El modo de validación usa una transacción de solo lectura, comprueba las tablas y vistas y no crea archivos ni bases.

```powershell
$env:TOCO_MYSQL_BACKUP_ENV = Join-Path $env:LOCALAPPDATA 'TocoMadera\mysql-backup.env'
.\backend\.venv\Scripts\python.exe -B database\preparar_compras_pruebas.py --validar
```

Se requiere acceso de lectura a las 26 tablas y cuatro vistas y `SHOW VIEW` para las definiciones. Para comprobar el inventario de objetos auxiliares, el script admite permisos directos `TRIGGER` y `EVENT` en el esquema o a nivel global, junto con `SHOW_ROUTINE` o `SELECT` global, o permisos directos equivalentes de administrador. Un recuento vacío sin visibilidad suficiente no se acepta. Si existen disparadores, procedimientos, funciones o eventos, el script se detiene y requiere un procedimiento que los incluya. No se otorgan permisos. Los procesos MySQL 8.4.8 reciben credenciales mediante archivos de opciones privados de vida corta, sin perfiles de conexión externos ni credenciales en argumentos.

## Etapas independientes

Ejecuta cada comando solo tras autorizar esa etapa. Los ejemplos usan `$carpeta` como la ruta impresa al generar el respaldo.

### 1. Generar exclusivamente el respaldo

```powershell
.\backend\.venv\Scripts\python.exe -B database\preparar_compras_pruebas.py --respaldar
```

El script fija la identidad del origen, exige InnoDB para todas las tablas y compara inventario, definiciones, conteos y huellas de filas antes y después del volcado. Usa `mysqldump --single-transaction` y excluye las vistas del SQL para recrearlas desde sus definiciones. Evita cambios de esquema durante la captura. Si el origen cambia, repite la captura. El respaldo válido consta de `respaldo.sql`, `vistas.json` y `respaldo.json`, que contiene las huellas SHA-256 del conjunto. La carpeta temporal se protege con ACL de Windows antes de escribir los datos. Conserva todos los archivos fuera del repositorio y de ubicaciones sincronizadas o compartidas.

### 2. Preparar una instancia y una base vacía

```powershell
$carpeta = '<ruta privada impresa por --respaldar>'
.\backend\.venv\Scripts\python.exe -B database\preparar_compras_pruebas.py --preparar "$carpeta"
```

Valida primero el respaldo y comprueba que el puerto esté libre. Inicializa un directorio nuevo con la red deshabilitada. Arranca sin TCP y con memoria compartida de nombre aleatorio, configura la contraseña de `root`, prueba la autenticación, verifica el UUID y el directorio, y cierra ese arranque. Solo entonces inicia el servidor TCP limitado al bucle local. Comprueba la identidad de nuevo antes de crear la base vacía. `conexion.json` y `mysql.log` permanecen en la carpeta privada.

### 3. Restaurar y verificar

```powershell
.\backend\.venv\Scripts\python.exe -B database\preparar_compras_pruebas.py --restaurar "$carpeta"
```

Exige un destino vacío y verifica la base, el puerto, el UUID, el directorio y la versión. El cliente de importación comprueba también el destino en la misma sesión antes de leer el SQL. Luego recrea las vistas con su definición y modo de seguridad. El definidor se adapta al entorno aislado. Comprueba la estructura de las tablas, las definiciones de las vistas, los conteos y las huellas de filas. Solo tras superar las verificaciones escribe `restauracion-verificada.json`, firmada con una clave de la carpeta privada y vinculada a la instancia, al respaldo y a la versión del archivo de migración.

### 4. Migrar solo la copia restaurada

```powershell
.\backend\.venv\Scripts\python.exe -B database\preparar_compras_pruebas.py --migrar "$carpeta" --confirmar-migracion "<UUID aislado mostrado al restaurar>"
```

Se requiere una autorización separada antes de ejecutar este comando. El UUID escrito debe coincidir con la instancia aislada. El script comprueba la constancia, las huellas de los archivos, la identidad, el contenido y la estructura de la copia y el índice único de movimientos de recepción antes de aplicar el SQL. No arranques Flask ni ejecutes escrituras concurrentes hasta terminar esta etapa.

## Recuperación

Si falla la preparación o la importación, conserva los archivos para diagnóstico y usa una carpeta privada nueva con una copia del conjunto de respaldo. Conserva la constancia como evidencia y vuelve a generarla a partir de una restauración verificada si cambia el respaldo, la instancia o el SQL de migración. Si falla uno de los dos cambios de esquema, el otro puede haberse aplicado. Restaura una copia nueva para repetir la migración. No uses los archivos de esta copia para restaurar sobre la base principal.

Después de migrar, Flask deberá usar una cuenta exclusiva de la copia, con su conexión inyectada en el proceso de prueba antes de importar la aplicación. Esta etapa no modifica Flask ni su archivo de configuración.

## Segunda copia aislada en el puerto 33318

Genera el respaldo en una carpeta nueva con `--respaldar` y usa esa carpeta en los tres comandos de destino. El puerto se valida junto con el UUID y el directorio en cada etapa.

```powershell
.\backend\.venv\Scripts\python.exe -B database\preparar_compras_pruebas.py --preparar "$carpeta" --puerto-aislado 33318
.\backend\.venv\Scripts\python.exe -B database\preparar_compras_pruebas.py --restaurar "$carpeta" --puerto-aislado 33318
.\backend\.venv\Scripts\python.exe -B database\preparar_compras_pruebas.py --migrar "$carpeta" --puerto-aislado 33318 --confirmar-migracion "<UUID de la segunda copia>"
```

La suite backend admite `TOCO_TEST_AISLADO=1`, `TOCO_TEST_PUERTO`, `TOCO_TEST_UUID` y `TOCO_TEST_CARPETA`. Comprueba la constancia y el historial, usa una cuenta temporal restringida al esquema aislado y compara de nuevo las huellas de los registros históricos tras limpiar sus datos de prueba.

## Migración principal pendiente de autorización

1. Programa una ventana de mantenimiento. Detén Flask, los procesos en segundo plano y cualquier otro escritor. Cierra sesiones de edición en Workbench. Conserva MySQL activo. Con una cuenta que tenga visibilidad global, comprueba transacciones abiertas, conexiones activas y bloqueos en `information_schema.innodb_trx`, `performance_schema.metadata_locks` y `SHOW PROCESSLIST`. Mantén los escritores detenidos hasta terminar la verificación.
2. Ejecuta `--validar` y `--respaldar` dentro de esa ventana. Verifica las huellas y compara objetos, datos y orden 7 con el respaldo certificado de la prueba. Si el origen cambió, restaura y verifica el respaldo final en otra copia antes de migrar. Comprueba que el SHA-256 del SQL es `2e13b6fb467541699955e5e5314d56652487ead81b795d0b31174a88a358dd76`. Confirma que las columnas e índices nuevos aún no existen, que ambas tablas y la tabla referida usan InnoDB y que `ordenes_produccion.id_orden` es una clave compatible con `BIGINT UNSIGNED`. Verifica también `uq_mm_detalle_compra`.
3. Después de la autorización, ejecuta desde la raíz del repositorio con un operador habilitado para el DDL. PowerShell solicita el usuario y el cliente solicita la contraseña de forma interactiva. El cliente ejecuta en modo por lotes, se detiene ante el primer error y comprueba la identidad en la misma sesión antes de los ALTER.

```powershell
$operador = Read-Host 'Usuario MySQL autorizado para el DDL'
$migracion = 'database/migrations/20261125_01_compras_asistidas.sql'
$hash = (Get-FileHash -LiteralPath $migracion -Algorithm SHA256).Hash
if ($hash -ne '2e13b6fb467541699955e5e5314d56652487ead81b795d0b31174a88a358dd76') {
    throw 'La huella de la migración no coincide.'
}
$identidad = @'
SET @toco_gate = IF(
    DATABASE() = 'toco_madera' AND @@port = 3306
    AND @@server_uuid = '75d9b091-3239-11f1-9208-60cf84707dee'
    AND VERSION() = '8.4.8',
    'SELECT DATABASE(), @@port, @@server_uuid, VERSION()',
    'SELECT * FROM information_schema.TOCO_MIGRATION_TARGET_MISMATCH'
);
PREPARE toco_gate FROM @toco_gate;
EXECUTE toco_gate;
DEALLOCATE PREPARE toco_gate;
SET SESSION lock_wait_timeout = 15;
'@
$sql = $identidad + "`n" + (Get-Content -Raw -LiteralPath $migracion)
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' --no-defaults --no-login-paths --protocol=TCP --host=127.0.0.1 --port=3306 --database=toco_madera --user=$operador --password --ssl-mode=REQUIRED --skip-reconnect --batch --execute=$sql
if ($LASTEXITCODE -ne 0) { throw 'MySQL se detuvo. Conserva el error y verifica el esquema antes de continuar.' }
```

4. Verifica las diez columnas, la FK `fk_compras_orden_asistida` y ambos índices nuevos de `compras`. Compara las huellas de las columnas originales, vistas, movimientos, existencias y los estados de compras con la captura inmediatamente anterior. Reabre Flask, confirma por lectura que el listado y detalle de compras manuales siguen funcionando y que la preparación de la orden 7 abre en Angular. Reserva las pruebas con escritura para la copia aislada.
5. Si falla el DDL, mantén detenidos los escritores. Los dos ALTER de InnoDB son operaciones independientes y el primero puede quedar aplicado. Registra la sentencia y el error, consulta `SHOW CREATE TABLE` en ambas tablas y verifica las huellas de los datos. Si solo se aplicó el primer ALTER, ensaya en una copia equivalente la ejecución de la segunda sentencia exacta y solicita autorización para recuperar. Si hay diferencias de datos o un estado inesperado, verifica el respaldo en otra instancia y prepara un plan de recuperación antes de reabrir. Evita repetir el archivo completo sobre un esquema parcial.

### Operador temporal del DDL

La cuenta `'toco_mig_20261125'@'127.0.0.1'` requiere TLS y admite una conexión simultánea. MySQL exige `ALTER`, `CREATE` e `INSERT` para `ALTER TABLE`. Los tres privilegios están limitados a `compras` y `compra_detalles`. La cuenta también tiene `REFERENCES` sobre la tabla referida `ordenes_produccion`. `USAGE` es la única entrada global y no concede operaciones. MySQL aplica estos permisos a las tablas, por lo que la cuenta puede insertar filas en ambas mientras esté desbloqueada. [Privilegios de ALTER TABLE](https://dev.mysql.com/doc/refman/8.4/en/alter-table.html) · [Privilegios de claves foráneas](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html)

Mantén la cuenta bloqueada hasta que la ventana, el respaldo y las verificaciones previas estén completos. Antes de desbloquear, comprueba el esquema, puerto, UUID y versión en la sesión administrativa. Tras la autorización de migración, desbloquéala justo antes de ejecutar el comando anterior. Una vez cerrada su conexión, vuelve a bloquearla, incluso ante un error parcial. Terminada la migración o cancelada la ventana de forma definitiva, retira la cuenta en el servidor comprobado con `DROP USER 'toco_mig_20261125'@'127.0.0.1'`, verifica su ausencia y retira el archivo privado de credenciales.

Para abrir la ventana, desconecta manualmente la conexión de desarrollo de MySQL Workbench, incluidos los editores y paneles asociados. Mantén detenidos Flask y los demás escritores durante el respaldo final y el DDL. Revisa de nuevo las conexiones, las transacciones ajenas, los bloqueos de metadatos y los eventos habilitados. `Sleep` solo describe el estado instantáneo de una sesión.

### Resultado de la migración principal

Se aplicaron los dos `ALTER TABLE` de `20261125_01_compras_asistidas.sql` en `toco_madera`, puerto `3306`, UUID `75d9b091-3239-11f1-9208-60cf84707dee`, MySQL `8.4.8`. La huella del archivo coincidió con la autorizada. El respaldo persistente es `%LOCALAPPDATA%\TocoMadera\respaldo-final-722bcb61a0f7`.

Se verificaron las diez columnas, los índices y la clave foránea nuevos, los índices preexistentes y las huellas de las 244 filas originales y las cuatro vistas. La consulta de preparación de la orden 7 devolvió HTTP 200 con siete faltantes y el listado de compras devolvió HTTP 200 con nueve compras, ambas en sesiones de solo lectura. El operador temporal se volvió a bloquear y luego se retiró junto con su archivo de credencial.

## Cierre funcional de compras asistidas

| Etapa | Ruta administrativa | Comportamiento |
| --- | --- | --- |
| Verificar materiales | `GET /api/v1/admin/produccion/<orden>/verificar-materiales` | Calcula requeridos, existencias, faltantes y elegibilidad. |
| Preparar compra | `GET /api/v1/admin/compras/preparacion/<orden>` | Angular abre `/admin/compras?orden=<orden>&folio=<folio>`. Precarga la cantidad sugerida pendiente de cubrir. La cobertura de borradores se informa aparte de las existencias. |
| Guardar | `POST /api/v1/admin/compras/` | Crea un borrador. El UUID de solicitud y su huella permiten devolver el mismo registro si se reintenta el mismo contenido, y rechazar con 409 un contenido diferente con la misma clave. |
| Abrir o editar | `GET /api/v1/admin/compras/<compra>`, `PUT /api/v1/admin/compras/<compra>` | Solo se edita un borrador con la revisión vigente. Guardar incrementa la revisión y deja el inventario intacto. Una revisión obsoleta devuelve 409. |
| Cancelar | `PATCH /api/v1/admin/compras/<compra>/cancelar` | Cierra el borrador sin entradas de inventario. |
| Recibir y comprobar | `PATCH /api/v1/admin/compras/<compra>/recibir`, `GET /api/v1/admin/inventario/` | Recibir registra en una transacción una entrada por detalle. El bloqueo de la compra y el índice único por detalle previenen una segunda entrada. Desde Compras se vuelve a Producción para verificar el stock actualizado. |

Se ejecutó una única prueba representativa con escrituras mediante el cliente HTTP de Flask contra la copia certificada `toco_madera_compras_pruebas` en `127.0.0.1:33318`, UUID `e30e563d-e92f-11f1-a99f-60cf84707dee`. Se comprobó el directorio de datos y la constancia antes de aprovisionar la cuenta temporal. La cuenta de aplicación quedó limitada al esquema aislado y sus conexiones volvieron a validar la identidad antes de usarse.

La prueba tomó la cantidad sugerida de 1 como entrada de la precarga y guardó un borrador con existencia inicial de 1. Editó la cantidad a 2, añadió un material de 4 unidades y comprobó el incremento de revisión. Guardar y editar dejaron las existencias intactas. Recibir devolvió 200 y creó exactamente dos entradas. Reintentar devolvió 409. Inventario devolvió existencias de 3 y 4 para los materiales de prueba. La nueva verificación de Producción permitió consumir y devolvió cero faltantes elegibles, sin ejecutar el consumo.

Los datos temporales se eliminaron por sus identificadores de prueba, se retiró la cuenta y las huellas de las 244 filas históricas y cuatro vistas coincidieron con el respaldo. La prueba de escritura se realizó mediante rutas Flask. La interacción de navegador había sido verificada con respuestas simuladas y las consultas de la orden 7 en la base principal se verificaron en solo lectura. La primera compra real en la base principal queda fuera de esta validación.
