# Toco Madera — Etapa 3.19.2 · Backend de órdenes de producción

**Alcance:** listados, detalle, creación de orden `PLANIFICADA` ligada a detalle de pedido `FABRICACION`, e inicio (`EN_PROCESO`). **No consume materias primas ni crea lotes ni genera entregas.**

## 1. Verificación de CSV

Cuatro archivos aportados: `tablas.csv` (15 objetos: 14 tablas y una vista), `columnas.csv`, `rel.csv` (18 llaves foráneas), `uno.csv` (índices). La creación usa exclusivamente columnas presentes en esos CSV. `ordenes_produccion` usa `id_orden`, `id_receta`, `id_detalle_pedido`, `cantidad`, `estado`, `texto_grabado`, `fecha_inicio`, `fecha_fin`, `observaciones`.

El `id_receta` se obtiene de `recetas` con `vigente=1` y corresponde al mismo producto del detalle del pedido. Se guarda su ID para no cambiar versión cuando se actualice la receta.

## 2. Instalar

Copiar **únicamente** `backend/app/routes/admin_produccion_routes.py` al directorio equivalente en tu proyecto; no reemplazar otros Blueprints.

En el archivo del proyecto `backend/app/__init__.py`, dentro de la función `create_app()` y **después** de crear/configurar Flask y sus extensiones, agrega el import y registro siguientes **una sola vez** (si existen otros registros, colócalo junto a ellos):

```python
from app.routes.admin_produccion_routes import admin_produccion_bp
app.register_blueprint(admin_produccion_bp)
```

Ajusta la indentación para dejarlos dentro de `create_app()`. No reemplaces `app/__init__.py` completo. Usa el nombre de variable Flask que ya exista (`app`).

En PowerShell desde `backend`:

```powershell
python -m compileall app run.py
python run.py
```

## 3. Endpoints — protegidos por JWT de ADMIN

- `GET /api/v1/admin/produccion/pendientes`: detalles de pedidos `CONFIRMADO`/`EN_PRODUCCION` con `FABRICACION` y unidades por planificar.
- `GET /api/v1/admin/produccion/`: últimas 200 órdenes.
- `GET /api/v1/admin/produccion/<id_orden>`: orden y cantidades requeridas por receta (aún sin descontar inventario).
- `POST /api/v1/admin/produccion/`: crea orden, requiere `id_detalle_pedido` y `cantidad` (enteros), `observaciones` opcional. HTTP 201 al crear, 409 por regla de negocio, 403 sin ADMIN, 401 sin JWT.
- `POST /api/v1/admin/produccion/<id_orden>/iniciar`: transición `PLANIFICADA` -> `EN_PROCESO`, HTTP 200. **No realiza consumo todavía**.

Ejemplo solicitud JSON para crear una orden (sustituye 1 por un detalle REAL devuelto en `/pendientes`):

```json
{"id_detalle_pedido":1,"cantidad":1,"observaciones":"Pedido de prueba"}
```

La orden se vincula al detalle y su grabado **desde MySQL**, nunca desde texto que envíe el navegador. La suma de órdenes que no están canceladas no puede superar la cantidad del detalle.

## 4. Pruebas desde PowerShell

Inicia sesión como administrador desde la web, abre DevTools Network y verifica que la app usa JWT vigente. Para probar API manualmente desde PowerShell, utiliza un token **local** (no lo copies a chats ni logs):

```powershell
$token = Read-Host 'Pega el JWT ADMIN de prueba (solo consola local)'
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/v1/admin/produccion/pendientes' -Headers $headers
Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/v1/admin/produccion/' -Headers $headers
```

Si todavía no existen pedidos (en las verificaciones anteriores aparecía 0), verás `total: 0` y `detalles: []`, lo cual es **correcto**. Primero crea un pedido confirmado con una cuenta CLIENTE y una receta vigente para ese producto.

Una vez encontrado un detalle real disponible:

```powershell
$body = @{ id_detalle_pedido = 1; cantidad = 1; observaciones = 'Prueba 3.19.2' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:5000/api/v1/admin/produccion/' -Headers $headers -ContentType 'application/json' -Body $body
```

**Modifica el ID antes de enviar** según `/pendientes`. Para comprobar orden y materiales, `GET /<id_orden>`; iniciar con `POST /<id_orden>/iniciar`.

## 5. Consultas SQL de verificación (solo lectura)

```sql
USE toco_madera;
SELECT id_orden, id_receta, id_detalle_pedido, cantidad, estado, texto_grabado, fecha_inicio
FROM ordenes_produccion ORDER BY id_orden DESC LIMIT 20;
SELECT id_movimiento, id_material, tipo, cantidad_firmada, id_orden_produccion
FROM movimientos_material ORDER BY id_movimiento DESC LIMIT 20;
```

Las pruebas 3.19.2 **no deberían insertar** movimientos de material. No ejecutar `TRUNCATE`, `DROP` ni `ALTER`.

## 6. Casos críticos

1. Sin JWT -> 401.
2. JWT CLIENTE -> 403.
3. Sin pedido confirmado de fabricación -> rechazo 409.
4. Pedido con cantidad 2: crear orden de 1, luego otra de 1; una tercera debe regresar 409.
5. Iniciar la orden -> `EN_PROCESO`.
6. Iniciar de nuevo -> 409.
7. La API de detalle devuelve receta y cantidades requeridas (sin consumo).
8. Compras, inventario y recetas anteriores continúan funcionando.

**Importante:** Las rutas se han verificado sintácticamente, pero no se han ejecutado contra tu instancia MySQL. Esta entrega no cierra la Etapa 3.19; al terminar todas las subetapas, se actualizará el README completo.
