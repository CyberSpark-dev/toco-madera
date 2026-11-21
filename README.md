# Toco Madera

> **«Frases que vienen de raíz y se graban en el corazón.»**

**Toco Madera** es una aplicación web progresiva (PWA) académica orientada a una empresa de transformación artesanal de madera en León, Guanajuato, México. Permite ofrecer productos de madera personalizables a clientes y centralizar, mediante un panel protegido, las operaciones administrativas del negocio.

**Estado de desarrollo (20 de noviembre de 2026):** etapas **3.18 y 3.19.2–3.19.6** probadas funcionalmente en las operaciones descritas abajo. El pedido académico **5** se liquidó con un pago simulado de **$165.00 MXN** y se confirmó una respuesta exitosa del endpoint de entrega; **la conciliación final del movimiento negativo y saldo de inventario en MySQL todavía requiere comprobación**. Carrito independiente por usuario validado. Dashboard con estadísticas reales y validación de instalación PWA pendientes. No se realizan pagos bancarios reales ni existe despliegue productivo.

## 1. Objetivo y alcance

El sistema modela la compra de materias primas, su transformación en artículos de madera y su venta al cliente. Incluye una interfaz pública y una interfaz administrativa. El proyecto está desarrollado por un equipo de cuatro integrantes, con una planificación académica de diez días de implementación y pruebas.

La plataforma integra catálogo, registro e inicio de sesión, personalización por grabado, carrito, pedidos, pagos de demostración, proveedores, compras, materiales, inventario y recetas versionadas. **La producción, el consumo transaccional, los lotes terminados y la programación de recolección ya tienen implementación y pruebas manuales; la entrega final aún no se ha validado.** Consulta la sección «Estado de los módulos» y la sección 16.

### Productos iniciales

1. Portateléfonos.
2. Marcos fotográficos.
3. Rodillos de cocina.
4. Repisas.
5. Portallaves.
6. Placas de escritorio.

La aplicación admite la administración de registros adicionales mediante el CRUD; los seis anteriores son el catálogo base del proyecto.

## 2. Identidad visual

| Elemento | Valor |
|---|---|
| Nombre | Toco Madera |
| Eslogan | Frases que vienen de raíz y se graban en el corazón. |
| Nogal | `#4B2E1F` |
| Terracota | `#A65A2E` |
| Crema | `#F9E9D5` |
| Verde salvia | `#718063` |
| Tipografías | Poppins e Inter (Google Fonts, con fuentes alternativas CSS) |

La interfaz se desarrolla con clases de **Tailwind CSS 4** y componentes/estilos compatibles con **Flowbite 4**.

## 3. Tecnologías

| Capa | Tecnologías |
|---|---|
| Frontend | Angular 22.2.0, TypeScript, componentes standalone, Angular Router, Signals, HttpClient |
| Estilos | Tailwind CSS 4, Flowbite 4, CSS |
| Visualización | Chart.js |
| Backend | Python 3.11.9, Flask, Blueprints, patrón Application Factory |
| Persistencia | MySQL 8, Flask-SQLAlchemy, PyMySQL |
| Seguridad | JWT mediante Flask-JWT-Extended, roles `ADMIN` y `CLIENTE`, guard Angular, interceptor HTTP y decorador backend `@admin_required` |
| Desarrollo | Visual Studio Code, PowerShell, MySQL Workbench, Git y GitHub |

**Decisión de alcance:** esta versión no utiliza Flutter, Android ni una aplicación móvil nativa. La interfaz de cliente y la de administración forman parte de la PWA Angular.

## 4. Arquitectura

```text
Navegador / PWA Angular
    |
    | HTTP/JSON + JWT
    v
API REST Flask (/api/v1)
    |
    | Blueprints, servicios, modelos ORM
    v
MySQL 8
```

**Frontend:** muestra el catálogo, formularios y dashboard; el guard limita la navegación hacia rutas administrativas y el interceptor incorpora el JWT a las peticiones dirigidas al backend.

**Backend:** valida credenciales, permisos y datos de entrada, ejecuta operaciones de negocio y consulta la base de datos.

**Base de datos:** conserva productos, categorías, usuarios y las entidades previstas para compras, inventarios, pedidos y producción. En las etapas de diseño se trabajó con un esquema de 25 tablas y cuatro vistas; las funcionalidades activas de esta versión no equivalen a la implementación de todos esos módulos.

> **Seguridad:** proteger una ruta con Angular no sustituye la autorización del servidor. Los endpoints administrativos se protegen también con JWT y `@admin_required` en Flask.

## 5. Estructura principal del proyecto

Esta estructura parte de las rutas y componentes documentados hasta la Etapa 3.18; los componentes adicionales de la Etapa 3.19 se indican en la sección 16. Es una referencia de los archivos trabajados; el repositorio puede contener otros módulos, modelos, archivos SQL y recursos.

```text
toco-madera/
├── README.md
├── backend/
│   ├── run.py
│   ├── requirements.txt                 # Si existe en el repositorio
│   ├── crear_admin.py                   # Alta controlada de un ADMIN
│   ├── .venv/                           # Local; nunca versionar
│   └── app/
│       ├── __init__.py                 # Application Factory y Blueprints
│       ├── config.py
│       ├── extensions.py               # SQLAlchemy y JWT
│       ├── models/                     # Incluye modelos de productos, categorías y usuarios
│       ├── routes/
│       │   ├── health_routes.py
│       │   ├── dashboard_routes.py
│       │   ├── producto_routes.py
│       │   ├── auth_routes.py
│       │   ├── admin_producto_routes.py
│       │   ├── admin_proveedor_routes.py
│       │   ├── admin_material_routes.py
│       │   ├── admin_compra_routes.py
│       │   ├── admin_inventario_routes.py
│       │   ├── admin_receta_routes.py
│       │   └── cliente_pedido_routes.py
│       └── utils/
│           └── permisos.py            # @admin_required
└── frontend/
    ├── angular.json
    ├── package.json
    └── src/
        ├── styles.css
        └── app/
            ├── app.config.ts
            ├── app.routes.ts
            ├── auth/
            │   ├── login/              # login.ts, login.html, login.css
            │   └── registro/           # registro.ts, registro.html, registro.css
            ├── cliente/
            │   ├── inicio/             # inicio.ts, inicio.html, inicio.css
            │   ├── carrito/            # carrito.ts, carrito.html, carrito.css
            │   ├── checkout/           # checkout.ts, checkout.html, checkout.css
            │   └── mis-pedidos/        # mis-pedidos.ts/html/css
            ├── core/
            │   ├── guards/admin.guard.ts
            │   ├── interceptors/auth.interceptor.ts
            │   └── services/
            │       ├── api.ts
            │       ├── auth.ts
            │       ├── admin-productos.ts
            │       ├── admin-proveedores.ts
            │       ├── admin-materiales.ts
            │       ├── admin-compras.ts
            │       ├── admin-inventario.ts
            │       ├── admin-recetas.ts
            │       ├── carrito.ts
            │       ├── catalogo-carrito.ts
            │       ├── cliente-pedidos.ts
            │       └── metodos-pago-demo.ts
            └── admin/
                ├── dashboard/          # dashboard.ts, dashboard.html, dashboard.css
                ├── productos/          # productos.ts, productos.html, productos.css
                ├── proveedores/        # proveedores.ts, proveedores.html, proveedores.css
                ├── materiales/         # materiales.ts, materiales.html, materiales.css
                ├── compras/            # compras.ts, compras.html, compras.css
                ├── inventario/         # inventario.ts, inventario.html, inventario.css
                └── recetas/            # recetas.ts, recetas.html, recetas.css
```

**Criterio de separación:** los servicios HTTP de Angular están en `core/services`; las vistas administrativas están en `admin`; los endpoints se organizan por Blueprint en `backend/app/routes`. Los formularios de catálogo no realizan cambios directos de inventario.

## 6. Requisitos de desarrollo

- Windows 11 y PowerShell (entorno utilizado durante el desarrollo; pueden utilizarse otros sistemas operativos ajustando los comandos).
- Python 3.11.9 y `pip`.
- Node.js y npm compatibles con la versión de Angular instalada. Verificar compatibilidad con `npx ng version` y los requisitos oficiales de Angular antes de actualizar Node.
- MySQL Server 8 y, opcionalmente, MySQL Workbench.
- Git y Visual Studio Code.
- Acceso al repositorio y a los scripts SQL del proyecto.

### 6.1. Clonar o abrir el proyecto

```powershell
git clone https://github.com/CyberSpark-dev/toco-madera.git
cd toco-madera
```

Si el proyecto ya está en el equipo, basta con abrir su carpeta en VS Code; **no es necesario clonarlo nuevamente**.

### 6.2. Preparar MySQL

1. Iniciar el servidor MySQL 8.
2. Crear/restaurar la base de datos usando los scripts SQL **reales del repositorio**, en el orden establecido para tablas, claves foráneas, vistas y datos iniciales.
3. Confirmar el nombre de la base de datos y configurar las credenciales de conexión en el backend.
4. Verificar que existen las categorías y los seis productos base.

```sql
-- Ejecutar en MySQL Workbench después de seleccionar
-- la base de datos real utilizada en la configuración:
SHOW TABLES;
SELECT COUNT(*) AS total_productos FROM productos;
SELECT COUNT(*) AS total_categorias FROM categorias;
```

**No ejecutar `DROP TABLE`, `TRUNCATE` o reinicializaciones del ORM sobre una base con datos que quieras conservar.**

### 6.3. Preparar el backend Flask

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip

# Instalar las dependencias declaradas por el proyecto:
python -m pip install -r requirements.txt
```

Configurar las variables requeridas por `backend/app/__init__.py` y los archivos de configuración existentes. Según cómo esté implementada la configuración del repositorio, normalmente incluyen conexión MySQL y clave secreta JWT. **No subir secretos reales a GitHub.** Mantener las credenciales en variables de entorno o en un archivo `.env` ignorado por Git, si el proyecto lo utiliza.

Iniciar:

```powershell
python run.py
```

En el desarrollo local descrito, Flask atiende en `http://127.0.0.1:5000`.

> Si todavía no existe `requirements.txt`, generarlo a partir del entorno virtual verificado y revisar su contenido antes de compartirlo: `python -m pip freeze > requirements.txt`.

### 6.4. Preparar el frontend Angular

Abrir otra terminal desde la raíz del repositorio:

```powershell
cd frontend
npm install
npx ng build
npm start
```

El frontend se ha probado localmente en `http://localhost:4200`.

**Nota sobre Google Fonts:** durante la Etapa 3.14 se resolvió un error `ECONNRESET` al compilar por la descarga de fuentes externas. La configuración de compilación utiliza `optimization.fonts.inline: false` en `frontend/angular.json`, manteniendo otras optimizaciones. El navegador aún puede requerir conexión para cargar Inter y Poppins.

### 6.5. Arranque diario

1. Iniciar MySQL.
2. Iniciar Flask desde `backend` con el entorno virtual activado.
3. Iniciar Angular desde `frontend` con `npm start`.
4. Abrir `http://localhost:4200`.
5. Acceder mediante `/login` con una cuenta válida.

## 7. Rutas del frontend

| URL local | Pantalla | Acceso |
|---|---|---|
| `/` | Catálogo / inicio | Público |
| `/login` | Inicio de sesión | Público |
| `/registro` | Registro de cliente | Público |
| `/admin/dashboard` | Panel administrativo y gráfica | ADMIN |
| `/admin/productos` | Gestión de productos | ADMIN |
| `/admin/proveedores` | Gestión de proveedores | ADMIN |
| `/admin/materiales` | Gestión de materias primas | ADMIN |
| `/admin/compras` | Registro, recepción y cancelación de compras | ADMIN |
| `/admin/inventario` | Existencias y movimientos de materias primas | ADMIN |
| `/admin/recetas` | Versiones de recetas y listas de materiales | ADMIN |
| `/cliente/carrito` | Artículos elegidos y personalización | Público |
| `/cliente/checkout` | Confirmación y pago simulado | CLIENTE |
| `/cliente/mis-pedidos` | Historial de pedidos propios | CLIENTE |

El guard `adminGuard` protege la navegación hacia `/admin/dashboard`, `/admin/productos`, `/admin/proveedores`, `/admin/materiales`, `/admin/compras`, `/admin/inventario` y `/admin/recetas`. La API aplica una comprobación adicional del rol en el servidor. Las páginas de carrito son públicas, mientras que el checkout y el historial requieren una cuenta CLIENTE.

## 8. Endpoints REST (base 3.18; incorporaciones 3.19 en la sección 16)

Prefijo local: `http://127.0.0.1:5000/api/v1`

### 8.1. Autenticación

| Método | Ruta | Propósito |
|---|---|---|
| POST | `/auth/registro` | Registrar cliente |
| POST | `/auth/login` | Validar credenciales y generar JWT |
| GET | `/auth/me` | Consultar usuario autenticado |
| GET | `/auth/admin-check` | Comprobar privilegios administrativos |

### 8.2. Catálogo y dashboard

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/productos/` | Consultar productos del catálogo público |
| GET | `/dashboard/status` | Comprobar endpoint administrativo protegido |

### 8.3. Productos administrativos

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/admin/productos/` | Listar productos activos e inactivos |
| GET | `/admin/productos/categorias` | Listar categorías para el formulario |
| POST | `/admin/productos/` | Registrar producto |
| PUT | `/admin/productos/{id_producto}` | Actualizar información comercial |
| PATCH | `/admin/productos/{id_producto}/estado` | Activar o desactivar producto |

Todos los endpoints del grupo `/admin/productos` exigen JWT y privilegios de administrador.

### 8.4. Proveedores administrativos — Etapa 3.16

| Método | Ruta | Función |
|---|---|---|
| GET | `/admin/proveedores/` | Consultar proveedores activos e inactivos |
| POST | `/admin/proveedores/` | Registrar proveedor |
| PUT | `/admin/proveedores/{id_proveedor}` | Editar datos de contacto y comerciales |
| PATCH | `/admin/proveedores/{id_proveedor}/estado` | Activar/desactivar sin borrar el historial |

**Ejemplo de registro:**

```json
{
  "nombre": "Proveedor de ejemplo",
  "contacto": "Persona de contacto",
  "telefono": "4770000000",
  "correo": "prueba@example.com",
  "direccion": "León, Guanajuato",
  "sitio_web": ""
}
```

La tabla `proveedores` tiene `id_proveedor`, `nombre`, `contacto`, `telefono`, `correo`, `direccion`, `sitio_web` y `activo`. Se relaciona mediante `id_proveedor` con `compras` y `cotizaciones_material`. La desactivación es lógica; no se eliminan las operaciones históricas.

### 8.5. Materias primas y unidades — Etapa 3.16

| Método | Ruta | Función |
|---|---|---|
| GET | `/admin/materiales/` | Listar materiales existentes, incluyendo inactivos |
| GET | `/admin/materiales/unidades` | Consultar unidades de medida válidas |
| POST | `/admin/materiales/` | Crear material |
| PUT | `/admin/materiales/{id_material}` | Actualizar datos editables |
| PATCH | `/admin/materiales/{id_material}/estado` | Activar/desactivar material |

**Ejemplo de registro:**

```json
{
  "sku": "PRUEBA_MAT_001",
  "nombre": "Madera de prueba",
  "descripcion": "Registro temporal para validar el CRUD",
  "id_unidad": 1,
  "stock_minimo": "5.0000"
}
```

El `id_unidad` anterior es **ilustrativo**: siempre se debe seleccionar uno que realmente exista en `/admin/materiales/unidades`. El `stock_minimo` se transmite como cadena decimal de hasta cuatro decimales. Las peticiones de cambio de estado reciben `{"activo": false}` o `{"activo": true}`.

**Seguridad común:** los endpoints de los grupos `/admin/proveedores` y `/admin/materiales` exigen JWT y autorización `ADMIN` en Flask. El guard Angular es una barrera de navegación adicional, no la autorización definitiva.


### 8.6. Compras y recepción — Etapa 3.17

| Método | Ruta | Función |
|---|---|---|
| GET | `/admin/compras/` | Listar compras, sus detalles y totales |
| GET | `/admin/compras/{id_compra}` | Consultar compra completa |
| POST | `/admin/compras/` | Crear compra y detalles en estado `BORRADOR` |
| PATCH | `/admin/compras/{id_compra}/recibir` | Registrar movimientos positivos y pasar a `RECIBIDA` |
| PATCH | `/admin/compras/{id_compra}/cancelar` | Cancelar únicamente `BORRADOR` |

**Estados de compra:** `BORRADOR`, `RECIBIDA` y `CANCELADA`. Una compra en borrador no altera existencias. La recepción se implementó como una transacción de MySQL con bloqueo `SELECT ... FOR UPDATE` en la cabecera para reducir el riesgo de recepciones simultáneas o duplicadas. La recepción crea movimientos `COMPRA` positivos asociados a cada detalle.

**Ejemplo de registro (identificadores ilustrativos: deben existir en MySQL):**

```json
{
  "id_proveedor": 1,
  "referencia_documento": "OC-PRUEBA-001",
  "observaciones": "Compra de prueba",
  "detalles": [
    { "id_material": 1, "cantidad": "10.0000", "costo_unitario": "25.0000" }
  ]
}
```

**Limitación identificada:** el endpoint entregado todavía no enlaza el campo nullable `compras.id_usuario_registro` con la identidad del JWT. Incorporar auditoría por usuario en el endurecimiento final; no interpretarlo como trazabilidad de autoría ya completada.

### 8.7. Inventario y movimientos — Etapa 3.17

| Método | Ruta | Función |
|---|---|---|
| GET | `/admin/inventario/` | Existencias por material, alertas y materiales sin existencias |
| GET | `/admin/inventario/movimientos` | Hasta 100 movimientos recientes por defecto (máximo 500), filtro opcional `id_material` |

La existencia de cada material se obtiene sumando `movimientos_material.cantidad_firmada`. No existe un contador separado que sea actualizado por el CRUD de materiales. Las entradas son positivas y los consumos deben ser negativos. Los movimientos incluyen tipo `COMPRA`, `CONSUMO`, `AJUSTE` o `DEVOLUCION` según el esquema MySQL. El módulo administrativo de la Etapa 3.17 **consulta movimientos; no habilita ajustes manuales**.

> **Criterio de alertas:** `existencia < stock_minimo`. Los materiales con umbral cero y saldo cero no necesariamente reciben la etiqueta «bajo mínimo», aunque sí se contabilizan en «sin existencia».

### 8.8. Recetas de fabricación — Etapa 3.17

| Método | Ruta | Función |
|---|---|---|
| GET | `/admin/recetas/` | Consultar versiones y sus ingredientes |
| GET | `/admin/recetas/catalogos` | Consultar productos y materiales para el formulario |
| POST | `/admin/recetas/` | Registrar una nueva versión y hacerla vigente |
| PATCH | `/admin/recetas/{id_receta}/activar` | Reactivar una versión previa |

Las recetas usan `recetas` y `receta_materiales`: producto, versión, vigencia, tiempos de fabricación/grabado, costos de mano de obra e indirectos, observaciones y cantidad por material para producir **una unidad**. Crear o activar una versión no genera movimientos de inventario. El versionado conserva el historial; los cambios de vigencia de un mismo producto se realizan en una transacción.

**Advertencia:** el costo de proceso de la receta (mano de obra e indirectos) no representa por sí solo el costo integral. La Etapa 3.19 incorporó consumo material transaccional y el catálogo `costo_base`; la actualización automática del costo integral y sugerencias de precio, sujetos a aprobación ADMIN y margen objetivo del 40 %, continúan pendientes.

**Ejemplo de cuerpo JSON para registro o edición:**

```json
{
  "id_categoria": 1,
  "sku": "TM-EJEMPLO-007",
  "nombre": "Producto de ejemplo",
  "descripcion": "Artículo artesanal de prueba",
  "precio_lista": "250.00",
  "permite_grabado": true,
  "max_caracteres_grabado": 40
}
```

**Ejemplo de cambio de estado:**

```json
{
  "activo": false
}
```

Los identificadores de categoría y los SKU del ejemplo deben adaptarse a los datos existentes. El precio se intercambia como cadena decimal para conservar su precisión.

### 8.9. Pedidos y pagos simulados — Etapa 3.18

| Método | Ruta | Rol | Función |
|---|---|---|---|
| GET | `/api/v1/cliente/pedidos/` | CLIENTE | Consultar pedidos propios |
| POST | `/api/v1/cliente/pedidos/` | CLIENTE | Confirmar pedido y pago de prueba |
| GET | `/api/v1/cliente/pedidos/<id>` | CLIENTE | Ver el detalle de un pedido propio |

El backend valida el rol, obtiene precios reales desde `productos`, almacena cabecera y renglones de `pedidos`/`pedido_detalles` y registra el pago ficticio en `pagos`. La vista `vw_saldos_pedidos` agrega total, pagado y saldo. El frontend gestiona la selección de **anticipo 50 %** o **pago total**. Se admiten **transferencia o tarjeta de demostración**; no se aceptan datos bancarios reales, ni se procesan fondos. La confirmación usa una clave de petición para reducir duplicados; la consistencia final depende de la transacción y la restricción única del folio.

### 8.10. Alta controlada de ADMIN — Etapa 3.18

Crear primero un cliente con una cuenta dedicada y, desde `backend` con permisos de operador del entorno local, ejecutar:

```powershell
python crear_admin.py --correo "admin@ejemplo.com"
```

Reemplazar el correo con el de la cuenta real. El comando exige confirmar expresamente la promoción. El registro público no permite seleccionar ADMIN. Cerrar sesión y volver a entrar para refrescar el rol. Esta herramienta no expone un endpoint web.

## 9. Reglas de negocio principales

1. Una cuenta administrativa debe tener JWT válido, usuario autorizado y rol `ADMIN` para operar endpoints protegidos.
2. El registro público crea cuentas de cliente; no permite autoconcederse el rol administrador.
3. El SKU identifica de forma única un producto.
4. El precio comercial debe ser positivo y respetar la precisión monetaria definida en MySQL.
5. Un producto puede admitir grabado personalizado con un límite de caracteres; si no admite grabado, su límite es cero.
6. La desactivación de productos es **lógica**: se cambia el campo `activo`, sin borrar el historial ni las relaciones de la base de datos.
7. Los artículos inactivos no deben ofrecerse en el catálogo público.
8. Los datos comerciales del producto se administran por separado de las existencias, lotes y movimientos de inventario.
9. Los proveedores conservan sus compras y cotizaciones históricas; se desactivan lógicamente mediante `activo`.
10. Los materiales utilizan un SKU único de hasta 40 caracteres y un nombre obligatorio de hasta 150 caracteres; su descripción es opcional y tiene un máximo de 250 caracteres.
11. `materiales.id_unidad` es una clave foránea que referencia `unidades_medida.id_unidad`; únicamente se aceptan unidades existentes.
12. `materiales.stock_minimo` es `DECIMAL(14,4)`, no negativo, y constituye un **umbral de reabastecimiento**, no la existencia actual en almacén.
13. El CRUD de materiales no altera existencias; las compras recibidas registran entradas positivas en `movimientos_material`.
14. Los materiales y proveedores pueden desactivarse sin eliminar físicamente registros asociados a compras, cotizaciones o producción.
15. Para pedidos personalizados se contempla un anticipo del **50 %** y liquidación contra entrega, o pago completo al realizar el pedido. La pasarela/pago es **simulado** en el alcance académico previsto.
16. Los pedidos grandes requieren un plazo de fabricación/entrega, mientras que los productos ya disponibles pueden entregarse antes, según existencias y operación.

17. Las compras inician como `BORRADOR`; solo la recepción genera movimientos de entrada y transición a `RECIBIDA`. Una compra recibida no se recibe ni cancela por segunda vez desde el módulo actual.
18. El inventario se calcula como `SUM(cantidad_firmada)` por material y se contrasta con `stock_minimo` sin sobrescribir movimientos previos.
19. Las recetas tienen versiones: solo una versión vigente por producto; nuevas versiones preservan el historial y no descuentan materiales.
20. Los pedidos y sus pagos simulados están implementados y requieren validaciones y transacciones atómicas. Las órdenes de producción, el consumo de materias primas y la generación de lotes se probaron manualmente; la programación de entregas y el aviso al cliente también. La liquidación del pedido de prueba 5 se comprobó con saldo final cero; el endpoint de entrega devolvió resultado exitoso según el desarrollador y queda pendiente la conciliación del egreso de producto en MySQL.
21. El carrito se separa por `id_usuario` en almacenamiento local del mismo navegador, no se comparte entre clientes y no se sincroniza entre dispositivos.
22. La entrega programada muestra fecha, lugar y estado a través de una API protegida, y el cliente consulta total, pagado y saldo desde el historial de pedidos.
23. Tiempos orientativos: producto disponible sin grabado, 3 a 6 horas sujeto a horario y stock; personalizado individual, 2 a 3 días hábiles; pedido por volumen (10 o más piezas), 5 a 7 días hábiles sujetos a confirmación. La fecha concreta debe acordarse, no asumirse garantizada.
24. Recolección en taller o punto acordado: sin cargo; envío urbano local previsto por cotización, no activo en el checkout de esta entrega. Los pagos de la prueba siguen siendo simulados.

El flujo fabricación-entrega alcanzó la respuesta exitosa de entrega del pedido 5; falta verificar los movimientos de egreso y el saldo final del lote en MySQL. La lectura de inventario y recetas fue desarrollada en la Etapa 3.17.

## 10. Estado de los módulos (base 3.18 y actualización 3.19)

| Módulo o capacidad | Estado al cierre |
|---|---|
| Estructura Angular 22 + Tailwind CSS 4 + Flowbite | Implementada |
| Backend Flask + Blueprints + conexión MySQL | Implementado |
| Base relacional y catálogo inicial de seis productos | Cargados en fases previas |
| Catálogo público | Implementado |
| Registro público CLIENTE, login de ambos roles y promoción ADMIN por consola | **Etapa 3.18: implementados** |
| JWT, roles, guard Angular, interceptor y decorador de permisos | Implementados |
| Dashboard administrativo | Funcional; indicadores comerciales aún provisionales |
| Gráfica semanal con Chart.js | Visible, datos de ejemplo |
| Cierre de sesión local con confirmación | **Etapa 3.18: comprobado en tienda y dashboard** |
| CRUD de productos, categorías, búsqueda y filtros | **Etapa 3.15: validada** |
| CRUD de proveedores, búsqueda y filtros | **Etapa 3.16: implementado; registro comprobado** |
| CRUD de materias primas y selector de unidades | **Etapa 3.16: diez pruebas funcionales confirmadas** |
| Carrito, personalización y pago simulado | **Etapa 3.18: integrados**; segregación del carrito por usuario probada posteriormente |
| Pedidos e historial del cliente | **Etapa 3.18: integrados y validados manualmente** |
| Compras, registro de detalles y recepción | **Etapa 3.17: validada manualmente** |
| Existencias, movimientos y alertas de materiales | **Etapa 3.17: validada manualmente** |
| Inventario de producto terminado | **Entrada PRODUCCION +1 validada; entrega exitosa reportada para pedido 5, falta confirmar salida ENTREGA -1 y saldo del lote en MySQL** |
| Recetas, ingredientes y versionado | **Etapa 3.17: diez pruebas confirmadas** |
| Órdenes de producción y consumos de materiales | **Etapas 3.19.2–3.19.3: pruebas manuales satisfactorias** |
| Seguimiento de entregas | **Programación, estado LISTO, API cliente, liquidación y respuesta de entrega exitosas; conciliación SQL de entrega pendiente** |
| Estadísticas reales desde MySQL | Pendiente; gráficas Chart.js obligatorias |
| Pruebas automatizadas, auditoría y despliegue | Pendiente |

### 10.1. Entregables de la Etapa 3.15

- CRUD protegido de productos y consulta de categorías.
- Registro, edición, activación y desactivación lógica.
- Tabla de productos, búsqueda, filtro, validaciones y mensajes de error.
- Desplazamiento automático al formulario de creación/edición.

### 10.2. Entregables de la Etapa 3.16

- Blueprint `admin_proveedor_routes.py` para GET, POST, PUT y PATCH.
- Servicio Angular `admin-proveedores.ts` y pantalla `/admin/proveedores`.
- Tabla administrativa de proveedores, búsqueda, filtros, formularios y cambio de estado.
- Confirmación de un registro de proveedor de prueba en MySQL desde Angular.
- Verificación del esquema de `materiales` y su relación con `unidades_medida`.
- Blueprint `admin_material_routes.py` con GET de materiales, GET de unidades, POST, PUT y PATCH.
- Servicio Angular `admin-materiales.ts` y pantalla `/admin/materiales`.
- Tabla de materiales, búsqueda, filtro activo/inactivo, formulario y confirmación de cambio de estado.
- Validaciones de SKU, descripción, unidad real y stock mínimo `DECIMAL(14,4)`.
- Diez comprobaciones funcionales del módulo de materiales confirmadas por el equipo.

### 10.3. Estructura verificada en MySQL para materiales

| Columna | Tipo | Regla |
|---|---|---|
| `id_material` | `BIGINT UNSIGNED` | PK autoincremental |
| `sku` | `VARCHAR(40)` | Obligatorio, único |
| `nombre` | `VARCHAR(150)` | Obligatorio |
| `descripcion` | `VARCHAR(250)` | Puede ser NULL |
| `id_unidad` | `SMALLINT UNSIGNED` | FK obligatoria a `unidades_medida.id_unidad` |
| `stock_minimo` | `DECIMAL(14,4)` | No nulo, predeterminado `0.0000` |
| `activo` | `TINYINT(1)` | No nulo, predeterminado `1` |

Antes del CRUD había diez materiales base observados en MySQL, entre ellos pino, triplay, pegamento, barniz, lijas, ganchos, tornillos, protector de marco, empaque y base de rodillo. Los registros de prueba posteriores pueden aumentar el total; por eso no debe utilizarse el número diez como conteo fijo del estado actual.

### 10.4. Entregables de la Etapa 3.17 — compras, inventario y recetas

**Compras y recepción**

- Blueprint `admin_compra_routes.py` con consulta, registro, recepción y cancelación de borradores.
- Servicio Angular `admin-compras.ts` y pantalla `/admin/compras`.
- Registro de cabecera y uno o varios detalles en una sola transacción.
- Totales calculados a partir de cantidades y costos unitarios.
- Recepción con movimientos positivos de materia prima y transición a `RECIBIDA`.
- Confirmación manual del usuario: **la compra se registra y puede recibirse**.

**Inventario y movimientos**

- Blueprint `admin_inventario_routes.py` con existencias agregadas y consulta de movimientos filtrados.
- Servicio `admin-inventario.ts` y pantalla `/admin/inventario`.
- Indicadores de stock bajo, materiales sin existencias, búsqueda y filtrado.
- Contraste de resultados con consultas de MySQL. El desarrollador confirmó la finalización de las verificaciones del módulo.

**Recetas y versionado**

- Blueprint `admin_receta_routes.py` con consulta, catálogos, creación de versión y activación.
- Servicio `admin-recetas.ts` y pantalla `/admin/recetas`.
- Tabla de recetas/ingredientes, formulario con múltiples materiales, tiempos y costos.
- Versiones históricas preservadas y una vigente por producto (regla aplicada por el backend).
- El desarrollador confirmó las **diez pruebas funcionales** del módulo de recetas.

### 10.5. Tablas verificadas para la Etapa 3.17

| Tabla | Uso dentro de la etapa |
|---|---|
| `compras` | Cabecera, proveedor, estado, referencia y observaciones |
| `compra_detalles` | Cantidades y costos unitarios por material |
| `movimientos_material` | Entradas de compra y libro de movimientos firmado |
| `materiales` | Catálogo y umbrales de stock |
| `proveedores` | Catálogo de proveedores para compras |
| `unidades_medida` | Unidades del catálogo de materiales |
| `recetas` | Versiones vigentes e históricas y costos/tiempos de proceso |
| `receta_materiales` | Materias primas y cantidades por unidad fabricada |

Las tablas `consumos_produccion`, `ordenes_produccion`, `lotes_producto` y `reservas_producto` también fueron identificadas en el esquema de la base de datos; **sus flujos funcionales aún no están desarrollados**.

### 10.6. Validación de la Etapa 3.18

- Cliente y administrador se distinguen con `roles` y JWT; el menú muestra acciones según rol.
- Carrito, login, compra y visualización de pedidos comprobados en pruebas manuales del usuario.
- `SHOW VIEW` y `SELECT` concedidos a `toco_app@localhost` sobre `vw_saldos_pedidos` y consultas repetidas tras la corrección.
- Los formularios de pago son **ejemplos simulados** de 16/18 dígitos con almacenamiento del identificador demo, no de los datos bancarios.
- Diálogo de confirmación de cierre de sesión en tienda y dashboard sin alterar los indicadores ni Chart.js.

## 11. Pruebas manuales realizadas / a mantener

### Autenticación y navegación

- Registrar un cliente y comprobar que accede al catálogo.
- Iniciar sesión como administrador y entrar al dashboard.
- Cerrar sesión y comprobar que una ruta administrativa redirige al login.
- Intentar consultar un endpoint protegido sin JWT y verificar una respuesta de rechazo.

### Compra y pagos ficticios — Etapa 3.18

- Completar el carrito con una cuenta CLIENTE, indicar grabado y confirmar un anticipo del 50 % o pago total.
- Probar la captura de tarjeta demo de 16 dígitos y CLABE ficticia de 18; rechazar datos no reconocidos.
- Verificar que la opción «Guardar para próximas compras» solo retiene el ID de un método público de prueba.
- Abrir «Mis pedidos» con sesión CLIENTE y comprobar HTTP 200; revisar el `saldo` con `vw_saldos_pedidos`.
- Comprobar que la cuenta ADMIN puede acceder al dashboard y no gestionar pedidos propios como CLIENTE.
- Confirmar y cancelar logout; el carrito debe conservar los artículos al cerrar sesión.
- Validar que Flask nunca reciba una tarjeta real o CLABE en el JSON del pedido.

### Productos

- Consultar los seis productos base.
- Buscar por nombre y SKU.
- Filtrar productos activos e inactivos.
- Abrir «Nuevo producto» y cargar categorías.
- Abrir «Editar» y comprobar que los datos aparecen en el formulario.
- Registrar y guardar datos válidos.
- Activar/desactivar y comprobar el comportamiento del catálogo público.
- Probar campos inválidos, SKU repetido y ausencia de permisos.

**Resultado reportado al cierre de la Etapa 3.15:** se verificó el funcionamiento del formulario nuevo, la edición y el guardado, después de corregir la carga/visibilidad del formulario. No se afirma que exista todavía cobertura de pruebas automatizadas.

### Proveedores — Etapa 3.16

- Abrir `/admin/proveedores` con sesión administrativa.
- Consultar la lista existente (inicialmente la tabla estaba vacía).
- Registrar un proveedor de prueba y comprobar su aparición en la tabla MySQL/Angular.
- Verificar búsqueda, filtros, edición y cambio de estado al finalizar la integración. **La evidencia conversacional confirma explícitamente el registro; no se declara aquí como probada toda la matriz de proveedores.**

### Materias primas — Etapa 3.16

Las **diez pruebas funcionales** fueron confirmadas por el equipo:

1. Flask reconoce las rutas CRUD de materiales.
2. Angular compila correctamente.
3. La pantalla muestra los materiales existentes.
4. El selector presenta unidades reales de MySQL.
5. «Nuevo material» abre el formulario.
6. Se puede registrar un material de prueba.
7. Se puede editar su descripción y stock mínimo.
8. Se puede desactivar y reactivar.
9. Los materiales originales permanecen intactos.
10. Sin JWT no se permite modificar materiales.

Estas comprobaciones son **manuales reportadas por el equipo**, no una suite automatizada ni una auditoría de seguridad independiente.


### Compras, recepción e inventario — Etapa 3.17

- Comprobar el rechazo de endpoints sin JWT.
- Registrar una compra `BORRADOR` con al menos un material y comprobar que el inventario no aumenta.
- Recibir la compra y comprobar el estado `RECIBIDA` y los movimientos `COMPRA` positivos.
- Rechazar una recepción duplicada y una cancelación posterior a la recepción.
- Abrir `/admin/inventario`, consultar existencias y comparar contra la suma en MySQL.
- Revisar alertas, filtros, historial y ausencia de entradas duplicadas por `id_detalle_compra`.

**Evidencia declarada:** el desarrollador confirmó que la compra se registra y recibe, y después que completó las verificaciones del módulo de inventario. No se adjunta en este README una ejecución automatizada ni resultados SQL exportados posteriores a esas pruebas.

### Recetas — Etapa 3.17

Las diez verificaciones confirmadas por el desarrollador incluyen detección de endpoints, compilación Angular, carga de la pantalla, catálogos, listado de recetas e ingredientes, copia de datos a una nueva versión, cambios en cantidades y observaciones, guardado, reactivación de una versión histórica y consulta de MySQL para detectar productos con más de una receta vigente.

Comandos útiles:

```powershell
# Desde frontend
npx ng build

# Desde backend
python -m compileall app run.py
python -c "from app import create_app; app=create_app(); print(app.url_map)"
```

## 12. Seguridad y consideraciones técnicas

- No compartir contraseñas, archivos `.env`, claves JWT ni tokens en el repositorio.
- Crear administradores únicamente mediante el comando local controlado `backend/crear_admin.py` (no existe alta pública de ADMIN).
- No confiar en las validaciones de Angular como única protección: Flask debe validar nuevamente todos los campos.
- La versión integrada de la Etapa 3.18 conserva el JWT y el perfil en `sessionStorage` para permanecer autenticado dentro de la misma pestaña tras una recarga. Se elimina al cerrar sesión y normalmente al cerrar la pestaña. **No equivale a revocación de tokens en el servidor** y exige protegerse frente a XSS.
- El botón «Cerrar sesión» limpia la sesión local y oculta el carrito de la cuenta anterior, pero **no implementa revocación del JWT en el servidor**. La revocación y la gestión robusta de sesiones quedan pendientes para un entorno productivo.
- Revisar CORS, expiración de tokens, variables de entorno, manejo de errores y auditoría antes de desplegar.
- El endpoint de dashboard de estado no equivale a que los indicadores de negocio ya estén conectados a consultas estadísticas reales.

## 13. Control de versiones y repositorio actual

**Repositorio principal desde la Etapa 3.16:** [CyberSpark-dev/toco-madera](https://github.com/CyberSpark-dev/toco-madera), rama `main`, remoto `origin` mediante HTTPS (sin llave SSH).

El remoto académico anterior puede permanecer bajo el nombre `anterior` como respaldo. Para confirmar el destino antes de publicar:

```powershell
git remote -v
git branch --show-current
git status
```

No utilizar `git init`, `git remote rename` ni `git push --force` para la publicación ordinaria. Para integrar la rama `fix/carrito-multiusuario` en `main`, revisar el estado de trabajo, confirmar y publicar la rama, actualizar `main` mediante `git pull --ff-only origin main`, fusionar con `git merge --no-ff fix/carrito-multiusuario`, verificar compilación y finalmente `git push origin main`. Antes de registrar una etapa:

```powershell
# Desde la raíz del repositorio
git status
git add README.md
git commit -m "docs: actualizar avance verificado etapa 3.19"
# Integrar cambios funcionales mediante rama y merge revisado; no forzar main.
```

Revisar siempre `git status` y `git diff --cached` antes del commit para asegurar que no se incluyan secretos, archivos temporales ni el entorno virtual.

## 14. Cierre funcional y alcance de la Etapa 3.18

### 14.1. Cliente, pedidos y pagos simulados (validado por el equipo)

**Flujo de cliente integrado:** catálogo público, login/registro con roles, navegación por sesión, carrito persistido en el navegador, personalización cuando el producto lo permite, checkout, selección de anticipo del 50 % o pago del 100 %, confirmación de pedido y consulta de pedidos propios. La autorización de pedidos corresponde al JWT del cliente; el servidor calcula importes y no confía en precios proporcionados por Angular.

**Simulación comercial:** únicamente `TARJETA_SIMULADA` y `TRANSFERENCIA_SIMULADA` para pedidos nuevos. El formulario solicita la captura manual de **datos de demostración**: tarjetas públicas de prueba de 16 dígitos o una CLABE ficticia de 18 dígitos. La aplicación rechaza otros números. No se captura CVV, no existe transferencia real, no se cobran fondos y **los números no se envían a Flask ni se guardan en MySQL**. La función «Guardar para próximas compras» conserva solo el identificador del ejemplo público, segregado por ID de cliente en el `localStorage` del navegador. No es un almacén de tarjetas reales ni un procesador PCI DSS.

**Roles y cuentas:** `CLIENTE` por registro público; `ADMIN` por procedimiento controlado en el backend. El comando de prueba es `python crear_admin.py --correo "<correo-existente>"` desde `backend` con `.venv` activo. Solo debe ejecutarlo una persona autorizada con acceso al servidor y la cuenta MySQL. Tras cambiar el rol, cerrar e iniciar sesión de nuevo. No exponer este comando mediante endpoint o UI pública.

**Sesión y navegación:** JWT y perfil persisten dentro de la pestaña mediante `sessionStorage`; el menú público muestra login/registro o identidad y enlaces por rol; confirmaciones de cierre de sesión en tienda y dashboard. El dashboard administrativo conserva las tarjetas KPI y la gráfica semanal Chart.js **con datos provisionales**.

**Permisos MySQL de la vista:** el error 1142 de SQLAlchemy al reflejar `vw_saldos_pedidos` se diagnosticó. El usuario de aplicación `toco_app@localhost` recibió permisos `SELECT` y `SHOW VIEW` sobre la vista; el equipo confirmó las pruebas funcionales posteriores. Nunca asignar `ALL PRIVILEGES` globales por esta causa.

**API utilizada:**

| Método | Ruta | Rol | Propósito |
|---|---|---|---|
| GET | `/api/v1/productos/` | Público | Catálogo activo |
| POST | `/api/v1/cliente/pedidos/` | CLIENTE | Crear pedido y registrar pago simulado |
| GET | `/api/v1/cliente/pedidos/` | CLIENTE | Listar pedidos propios |
| GET | `/api/v1/cliente/pedidos/<id>` | CLIENTE | Consultar detalle propio |

**Pruebas confirmadas en conversación:** navegación, login y persistencia de sesión, carrito, checkout de tarjeta/transferencia ficticias, guardado de métodos demo, cierre de sesión, roles y consulta de pedidos. La compilación y los resultados de ejecución dependen del repositorio local del equipo. No existe pasarela de pago real, tokenización bancaria ni despliegue productivo.

### 14.2. Límites del corte documental

El bloque anterior conserva el cierre histórico de la Etapa 3.18. El estado posterior se documenta en la **sección 16**: producción y programación de entregas ya probadas, liquidación y entrega final aún pendientes.

El dashboard mantiene sus KPI y la gráfica semanal Chart.js con **valores provisionales**, no estadísticas integradas desde MySQL. Los pagos son **solo una simulación académica** y no están conectados a una pasarela, banco ni procesador de tarjetas. La persistencia de métodos ficticios en `localStorage` es local al navegador y no corresponde a una billetera bancaria.

### 14.3. Criterios de cierre aplicados

- El usuario confirmó las pruebas de navegación, catálogo, login con rol CLIENTE y ADMIN, checkout, dos métodos simulados, métodos de prueba guardados y consulta de pedidos.
- Se corrigió el privilegio `SHOW VIEW` necesario para reflejar `vw_saldos_pedidos` desde SQLAlchemy con la cuenta `toco_app@localhost`.
- Se añadió confirmación previa al cierre de sesión del cliente y del dashboard administrativo, preservando Chart.js y sus indicadores.
- No se asegura cobertura automatizada, auditoría de seguridad, integración bancaria ni despliegue real.

## 15. Historial de hitos

| Etapa | Resumen |
|---|---|
| 3.13 | Backend Flask, MySQL, modelos y autenticación base |
| 3.14 | Integración de login/registro Angular, JWT, guard, dashboard y cierre de sesión |
| **3.15** | **CRUD administrativo de productos: consulta, categorías, alta, edición, búsqueda, filtros y cambio de estado; validación funcional completada** |
| **3.16** | **Proveedores y materias primas: CRUD protegido, formularios Angular, unidad de medida, validaciones de stock mínimo y diez pruebas confirmadas del módulo materiales** |
| **3.17** | **Compras y recepción, existencias y movimientos, recetas versionadas: desarrollo y pruebas manuales confirmadas** |
| **3.18** | **Cerrada: catálogo, carrito, checkout, pedidos, pagos ficticios (transferencia/tarjeta), métodos demo guardados, roles y confirmaciones de logout; pruebas manuales del usuario completadas** |
| **3.19.2** | Orden de producción y listado de pendientes, verificados manualmente |
| **3.19.3** | Consumo transaccional de materiales, stock y control de duplicados, validados |
| **3.19.4** | Fabricación terminada: lote y movimiento de entrada `PRODUCCION +1` verificados |
| **3.19.5** | Programación, LISTO, liquidación simulada del pedido 5 (saldo 0) y respuesta exitosa de entrega; falta conciliación SQL del movimiento de salida |
| **3.19.6** | Integración de historial financiero y avisos en Mis pedidos; seis comprobaciones funcionales confirmadas |
| Corrección transversal | Carrito independiente por usuario; separación y retorno a la cuenta probados |
| 3.20 y entrega | Gráficas reales, PWA instalable, pruebas integrales y entrega final pendientes |

---

**Política de documentación:** al terminar cada etapa numerada completa se actualiza **todo este README general**, con información verificable sobre funcionalidades terminadas, pruebas realizadas y pendientes. No se documentan como concluidos módulos aún no construidos.

**Proyecto académico — Toco Madera, León, Guanajuato, México.**

**Actualización documental:** 20 de noviembre de 2026 — etapas 3.19.2–3.19.6, liquidación y respuesta de entrega verificadas; pendiente conciliación SQL final de la salida de inventario.


## 16. Actualización funcional de la Etapa 3.19 (20/11/2026)

> **Estado del corte:** producción, programación, seguimiento y liquidación simulada validados manualmente. La operación de entrega devolvió resultado exitoso según el desarrollador. **El cierre integral exige verificar en MySQL el movimiento `ENTREGA -1`, existencia final y prevención de doble entrega**, aún pendientes de evidencia.

### 16.1. Producción y materiales (validado)

- `3.19.2`: consulta de pendientes y órdenes de producción; orden de referencia **1**, ligada a un rodillo personalizado del pedido **5**, iniciada en `EN_PROCESO`.
- `3.19.3`: verificación de los materiales de receta, compra/recepción de insumos, consumo transaccional e inserción de movimientos negativos de material. El usuario confirmó las pruebas esperadas y el bloqueo de duplicidades.
- `3.19.4`: registro de lote de producto terminado y movimiento `PRODUCCION` por **+1 unidad**; las consultas de lote y movimiento se validaron en Workbench. La finalización completa debe seguir verificándose al revisar el estado de la orden.
- Materiales con `costo_base`: campo usado para estimaciones académicas de costeo, independiente del precio de compra histórico. La automatización de margen objetivo (40 %) y aprobación administrativa de precios continúa pendiente.

### 16.2. Entregas y seguimiento (parcialmente validado)

- `3.19.5`: consulta administrativa de cinco pedidos, programación de recolección, punto acordado, cambio de pedido a `LISTO` y aviso por la API del cliente. En las pruebas: pedido **5**, `RECOLECCION`, `PROGRAMADA`, fecha **2026-11-24 16:30:00**, punto **Local La Calzada 202, Col. La Moderna**. Estos datos corresponden a un caso de prueba y no a una certificación de dirección comercial.
- `3.19.6`: la pantalla **Mis pedidos** combina historial (artículos, pagos, total, pagado y saldo) con seguimiento (fecha, punto y aviso). El usuario confirmó seis verificaciones funcionales, incluida compilación Angular.
- El pedido 5 conservaba saldo simulado **$165.00 MXN** antes de liquidarlo. No se declara pagado ni entregado todavía.
- Los plazos son informativos hasta confirmación administrativa: 3–6 h si existe stock listo; 2–3 días hábiles para personalizado individual; 5–7 días hábiles para pedidos de volumen. Las condiciones operativas pueden modificar el compromiso.

### 16.3. Carrito segregado por usuario (validado)

El carrito pasó de una clave global compartida a claves locales por identificador de usuario (por ejemplo `tm_carrito_usuario_3_v1`). Al cerrar sesión, desaparece el carrito visible; al ingresar un cliente diferente, solo se carga su propio carrito; el cliente anterior recupera el suyo en el mismo navegador. El usuario confirmó la corrección. **No hay sincronización del carrito entre dispositivos**; un pedido confirmado sí se conserva en MySQL. No debe utilizarse el carrito del navegador como autoridad sobre stock, precios ni permisos.

### 16.4. Rutas añadidas o validadas

| Método | Endpoint relativo a `/api/v1` | Rol | Estado |
|---|---|---|---|
| GET | `/admin/produccion/pendientes` | ADMIN | Validado |
| GET | `/admin/produccion/<id_orden>/verificar-materiales` | ADMIN | Validado |
| POST | `/admin/produccion/<id_orden>/consumir-materiales` | ADMIN | Validado |
| GET | `/admin/producto-terminado/orden/<id_orden>/verificar` | ADMIN | Validado en flujo de prueba |
| POST | `/admin/producto-terminado/orden/<id_orden>/finalizar` | ADMIN | Lote y movimiento de entrada verificados |
| GET | `/admin/entregas/pedidos` | ADMIN | Validado |
| POST | `/admin/entregas/pedido/<id_pedido>/programar` | ADMIN | Validado |
| POST | `/admin/entregas/pedido/<id_pedido>/listo` | ADMIN | Validado |
| GET | `/cliente/seguimiento/mis-pedidos` | CLIENTE | Validado |
| POST | `/admin/entregas/pedido/<id_pedido>/liquidar-saldo` | ADMIN | **Prueba funcional exitosa reportada** |
| POST | `/admin/entregas/pedido/<id_pedido>/entregar` | ADMIN | **Prueba funcional exitosa reportada** |

Los módulos de esta etapa usan archivos `backend/app/routes/admin_produccion_routes.py`, `admin_producto_terminado_routes.py` y `admin_entregas_routes.py` y las tablas existentes de órdenes, consumos, lotes, movimientos, pedidos, pagos y entregas. La migración incremental de recolección se encuentra en `database/01_punto_recoleccion.sql`. No ejecutar migraciones dos veces ni borrar datos de prueba antes del respaldo.

### 16.5. Evidencias confirmadas

1. Consumo de materiales de la orden de rodillo; movimientos y stock resultante revisados.
2. Movimiento de producto terminado `PRODUCCION` con cantidad firmada **+1**.
3. Consulta administrativa de cinco pedidos con estados y saldos simulados.
4. Pedido 5 en `LISTO`, entrega `PROGRAMADA`, fecha/lugar y `aviso` devueltos al CLIENTE.
5. Seis comprobaciones de interfaz **Mis pedidos** confirmadas por el desarrollador.
6. Carrito multiusuario corregido y validado según el desarrollador.

**No realizados o no confirmados al emitir este documento:** consulta SQL de estado `ENTREGADO`, movimiento `ENTREGA -1`, existencia final del lote, rechazo de doble entrega, gráficas comerciales basadas en MySQL, pruebas integrales PWA y paquete final para evaluación. **Sí realizados:** liquidación simulada por $165.00 MXN (saldo final $0.00) y respuesta exitosa de entrega reportada.

### 16.6. Próximo recorrido de demostración

1. Ejecutar MySQL 8, Flask (`backend`) y Angular (`frontend`) localmente desde la misma computadora.
2. Ingresar con dos cuentas de CLIENTE para demostrar aislamiento y persistencia del carrito.
3. Completar checkout simulado y mostrar pedido, total, anticipo y saldo en **Mis pedidos**.
4. Consultar como ADMIN compras, materiales, inventario, recetas y orden de producción.
5. Mostrar producto terminado, programación de entrega y aviso de recolección.
6. **Realizado:** liquidación simulada de $165.00 MXN con saldo cero y respuesta exitosa de entrega. **Pendiente:** verificar en MySQL estado, movimiento negativo y existencia del lote, y comprobar protección contra doble entrega.
7. **Pendiente:** conectar al menos tres gráficas administrativas a consultas reales MySQL y confirmar estado PWA instalable/servicio de aplicación con compilación de producción.

**Restricciones de la demostración:** se ejecuta como versión web local en la computadora del equipo; la PWA y el backend no se consideran publicados en internet. Todos los importes y cobros de la demostración son simulados.


## 17. Corte de cierre comercial del pedido de demostración n.º 5 (20/11/2026)

### 17.1. Evidencia funcional confirmada

- Orden de producción **1**: rodillo de cocina personalizado; se verificó la creación del lote y la entrada de inventario de producto terminado `PRODUCCION +1`.
- Pedido **5**: programado para recolección **2026-11-24 16:30:00**, en **Local La Calzada 202, Col. La Moderna**. Este punto se utilizó en el escenario de prueba; no debe presentarse como ubicación comercial verificada independientemente.
- Pantalla **Mis pedidos**: seis verificaciones confirmadas; muestra artículos y pagos, aviso de estado, fecha, lugar y resumen financiero.
- Liquidación: endpoint ADMIN `/api/v1/admin/entregas/pedido/5/liquidar-saldo` respondió `success: true`, `monto: 165.00`, `metodo: TRANSFERENCIA_SIMULADA`. La consulta posterior reportó `saldo_simulado: 0`.
- Entrega: el desarrollador confirmó una **respuesta exitosa** del endpoint `POST /api/v1/admin/entregas/pedido/5/entregar`. El cierre fue una **simulación académica**, no prueba de recolección física; la fecha programada era futura al momento de ejecución.

### 17.2. Verificación SQL del inventario terminado

Ejecutar en MySQL Workbench contra la base real del proyecto (en la instalación de desarrollo se utilizó `toco_madera`):

```sql
USE toco_madera;

SELECT id_pedido, estado FROM pedidos WHERE id_pedido = 5;
SELECT id_pedido, estado, programada, entregada, receptor FROM entregas WHERE id_pedido = 5;
SELECT mp.id_movimiento, mp.tipo, mp.cantidad_firmada, mp.id_lote
FROM movimientos_producto AS mp
JOIN lotes_producto AS lp ON lp.id_lote = mp.id_lote
WHERE lp.id_orden = 1 ORDER BY mp.id_movimiento;
SELECT mp.id_lote, SUM(mp.cantidad_firmada) AS existencia
FROM movimientos_producto AS mp
JOIN lotes_producto AS lp ON lp.id_lote = mp.id_lote
WHERE lp.id_orden = 1 GROUP BY mp.id_lote;
```

**Evidencia recibida (20/11/2026):** MySQL Workbench devolvió para el lote `1` dos movimientos: `PRODUCCION +1` y `ENTREGA -1`. Esto verifica el registro de la salida y su balance neto **0**. Los resultados de `pedidos.estado`, `entregas.estado` y la protección 409 ante una segunda entrega todavía deben guardarse como evidencias adicionales; no se afirma aquí que hayan sido comprobados visualmente.

### 17.3. Siguiente bloque obligatorio: estadísticas reales del dashboard

**Pendiente de implementación y pruebas:** conectar por API Flask/MySQL al menos tres gráficas en Angular/Chart.js: **ventas o importe de pedidos confirmados por día**, **pedidos por estado** y **productos por unidades vendidas**. Diferenciar expresamente ventas/pedidos confirmados de **cobros simulados**. Los KPI actuales y la gráfica con números provisionales **no deben presentarse como estadísticas reales**.

### 17.4. Entrega técnica pendiente

Ejecutar `npx ng build`, verificar el manifiesto, service worker e instalación de la PWA en contexto seguro o localhost; mantener la demostración **web local** con Flask y MySQL activos. Crear respaldo de la base de datos, ejemplos de configuración sin secretos, evidencias del flujo y README definitivo después de las pruebas.


## 18. Etapa 3.20.1 — Gráficas reales del dashboard (paquete preparado; pendiente de instalar y probar)

Se preparó el endpoint ADMIN `GET /api/v1/dashboard/estadisticas`, utilizando `pedidos`, `pedido_detalles`, `productos` y `pagos` de MySQL. Devuelve cuatro indicadores, tres series para Chart.js y, por separado, el importe de pagos simulados aprobados. Se excluyen del cálculo de ventas los pedidos `CANCELADO` y `PENDIENTE_ANTICIPO`. **Importe de pedidos ≠ cobros bancarios reales.** Los nombres de productos se obtienen de la tabla `productos`.

**Archivos:** `backend/app/routes/dashboard_routes.py`, `frontend/src/app/admin/dashboard/dashboard.ts` y `dashboard.html`. El Blueprint `dashboard_bp` ya está registrado; no duplicarlo. La creación de estadísticas es una implementación propuesta y todavía requiere ejecución de Flask, respuesta JSON real, `npx ng build`, revisión visual y validación del rol ADMIN.

**Pendientes finales:** confirmar estado SQL de entrega y protección contra duplicado; validar tres gráficas con datos reales, comprobar instalación PWA en localhost, actualizar evidencia y hacer commit/push.


---

## Etapa 3.20.2 — Revisión y autorización administrativa de pedidos
- Vista ADMIN `/admin/pedidos` con listado, detalle, filtros y decisiones.
- Tabla `autorizaciones_pedido`: APROBADO/RECHAZADO, decisión independiente del estado comercial.
- El usuario confirmó MySQL: pedidos #2, #3 y #4 APROBADO; #1 POR_REVISAR; #5 ENTREGADO histórico.
- Rutas `/api/v1/admin/revision-pedidos/`, `/<int:id_pedido>` y `/decision` visibles en el mapa Flask.
- Lista administrativa Angular visualmente verificada por captura.

## Etapa 3.20.3 — Estado de autorización para CLIENTE (pendiente de validación local)
- GET `/api/v1/cliente/pedidos/` y GET `/api/v1/cliente/pedidos/<id>` incorporan `autorizacion: { estado, fecha_decision, motivo }` para cada pedido propiedad del CLIENTE autenticado.
- `HISTORICO_ENTREGADO` representa únicamente una entrega histórica sin registro de autorización. No crea ninguna fila ni afirma que fuera aprobada.
- Angular `Mis pedidos` muestra explícitamente POR_REVISAR/APROBADO/RECHAZADO/HISTORICO_ENTREGADO y fechas/motivos cuando corresponda.
- No cambian el checkout, pagos simulados, esquema MySQL, Blueprints ni entregas.
- Requiere `autorizaciones_pedido` instalada en 3.20.2.
- PRUEBAS PENDIENTES: compilar Angular localmente, iniciar Flask, confirmar visibilidad de autorizaciones en CLIENTE #2/#3/#4 y privacidad entre usuarios.

## Siguiente etapa priorizada
- Vista CLIENTE: revisión visual del detalle y seguimiento.
- Seis imágenes demostrativas de productos locales.
- PWA instalable, respaldo, README, Git y demo.


---
## ETAPA 3.20.4 — TALLER Y ENTREGAS: PANEL VISUAL DE OPERACIONES

**Entregado para instalar, pendiente de pruebas en el equipo del desarrollador.**

- Angular: ruta ADMIN protegida `/admin/operaciones`, accesible desde el dashboard y Revisión de pedidos.
- Vista de pedidos con estados, cliente, saldo simulado, programación y autorización.
- Operación integral del taller usando endpoints YA EXISTENTES: pendientes de fabricación, planificar, iniciar, verificar materias primas, consumir, verificar/finalizar producto terminado, programar recolección, marcar LISTO, liquidar saldo simulado, confirmar entrega.
- Botones condicionales y confirmaciones explícitas; los permisos y las validaciones definitivas siguen en Flask y MySQL.
- Sin modificaciones SQL ni Python. No afecta las tres gráficas reales, el checkout, el carrito ni la visibilidad de autorización y entrega en la vista del cliente.
- Pedido #5 histórico entregado: solo lectura. Pedidos #2/#3/#4 autorizados: operables en orden según prerequisitos. Pedido #1 requiere autorización.
- El cliente actualiza su estado en «Mis pedidos» mediante consulta; no existe notificación push.
- Pruebas pendientes: `npx ng build` en Windows, cargar pantalla, ejecutar un flujo real con verificación de inventario/pagos, confirmar estados cliente/admin.
- Próxima etapa: seis imágenes demostrativas de catálogo; cierre y validación instalable PWA.

Ver `INSTRUCCIONES.md` y `CAMBIOS_MINIMOS.md` del paquete 3.20.4.


## Etapa 3.20.5 — Ventas por fecha en MXN y anillo comercial (pendiente de validación en PC)

- Se actualiza `backend/app/routes/dashboard_routes.py` sin agregar nuevos endpoints ni modificar tablas.
- `GET /api/v1/dashboard/estadisticas` conserva sus contratos JSON, KPI, protección ADMIN y gráfica de productos más vendidos.
- **Ventas por fecha:** importes (MXN) de pedidos no cancelados, calculados desde `pedido_detalles.cantidad * precio_unitario_acordado`, más envío menos descuento, agrupados por `DATE(pedidos.fecha)` en los últimos siete días; no es número de pedidos ni cobros bancarios.
- **Anillo:** tres grupos estables: `CONFIRMADO` (también `EN_PRODUCCION` y `LISTO`), `ENTREGADO`, `CANCELADO`; `PENDIENTE_ANTICIPO` no entra al anillo. La API devuelve 0 cuando no hay registros.
- Angular (`dashboard.ts`) muestra eje y tooltips monetarios y etiquetas de los tres estados.
- HTML basado en la versión 3.20.4, conservando accesos a `/admin/operaciones` y `/admin/pedidos`.
- Validación local completada: sintaxis Python, integridad del ZIP. **Pendiente:** `npx ng build` y consulta Flask contra MySQL en Windows.
- **Siguiente etapa:** imágenes demostrativas de los seis productos, integración en catálogo/carrito/checkout/Mis pedidos; validación PWA y documentación final.


## Etapa 3.20.7 — Imágenes de producto en checkout e historial (pendiente de validación)

- Catálogo: imágenes ambientadas de los seis productos y logotipo oficial en portada (preparado en 3.20.6).
- Carrito/configuración: imágenes limpias con grabados demostrativos (preparado en 3.20.6).
- Mis pedidos: el backend devuelve `nombre_producto` en los detalles mediante LEFT JOIN a `productos`; Angular muestra la imagen limpia y conserva la autorización, estado de entrega, totales, saldos y pagos.
- Checkout: colocar la imagen limpia en el listado del carrito mediante `imagenProducto(item.nombre, 'solo')`; el formulario de pagos permanece intacto.
- Sin cambios de estructura SQL, reglas comerciales ni movimientos de almacén.
- Validación pendiente: `python -m py_compile`, `npx ng build`, comprobación visual y pruebas con dos cuentas cliente.
- Próxima etapa 3.21: manifest, iconos PWA, service worker, build de producción y pruebas de instalación.


---

## Etapa 3.20.8 — Gestión de clientes y perfil de usuario

### Funcionalidades incorporadas
- Administrador: acceso desde Dashboard a **Gestionar clientes** (`/admin/clientes`); lista de cuentas CLIENTE, búsqueda, datos públicos, total histórico de pedidos confirmados, cinco productos más comprados, edición de nombre/correo/teléfono, desactivación y reactivación lógica.
- Cliente autenticado: enlace **Mi cuenta** en la página principal (`/cliente/mi-cuenta`); edición de nombre/correo/teléfono; cambio de contraseña validando la contraseña actual.
- No se eliminan filas en `usuarios` ni pedidos. Al desactivar una cuenta se conserva el historial. No se cambian roles ni contraseñas de clientes desde administración.

### API añadida
- `GET /api/v1/admin/clientes/` — solo ADMIN
- `GET /api/v1/admin/clientes/<id>` — solo ADMIN
- `PATCH /api/v1/admin/clientes/<id>` — solo ADMIN
- `PATCH /api/v1/admin/clientes/<id>/estado` — solo ADMIN; `{"activo":false}`
- `GET /api/v1/perfil/` — JWT del propietario
- `PATCH /api/v1/perfil/` — JWT del propietario
- `POST /api/v1/perfil/password` — JWT del propietario y contraseña actual.

### Medición comercial
Total de compras: suma `pedido_detalles.cantidad * precio_unitario_acordado` más envío menos descuentos una sola vez por pedido, únicamente en estados `CONFIRMADO`, `EN_PRODUCCION`, `LISTO` y `ENTREGADO`. No corresponde a dinero efectivamente cobrado. Productos más comprados: unidades de esos mismos pedidos, máximo cinco productos.

### Seguridad y restricciones
- El servidor verifica JWT y rol ADMIN en cada acción administrativa.
- Las contraseñas se guardan con el mecanismo de hash existente de `Usuario.establecer_password`.
- El cliente debe proporcionar la contraseña actual; la nueva contraseña debe tener 10–128 caracteres y contener letras y números.
- El frontend cierra la sesión actual al cambiar contraseña. **Importante:** los JWT previamente emitidos en otras sesiones NO se revocan automáticamente con esta implementación; siguen siendo válidos hasta expirar, salvo cuentas desactivadas donde el endpoint compruebe su estado. Para revocación global hace falta token blocklist o versión de sesión.
- No se realiza migración de base de datos. Requiere esquema ya existente de `usuarios`, `roles`, `pedidos`, `pedido_detalles` y `productos`.

### Validación rápida
1. Reiniciar Flask y compilar `npx ng build` desde `frontend`.
2. Iniciar sesión como ADMIN y verificar `/admin/clientes`; editar un cliente de prueba.
3. Desactivar y reactivar una cuenta de prueba; comprobar que el historial no desaparece.
4. Iniciar sesión como CLIENTE y modificar nombre/teléfono; comprobar `/api/v1/auth/me`.
5. Cambiar contraseña con contraseña actual; comprobar regreso a login y acceso con contraseña nueva.
6. Probar permisos: un CLIENTE no puede usar `/api/v1/admin/clientes/` (HTTP 403).

La etapa 3.21 PWA permanece **pendiente de instalación/pruebas**; esta etapa no modifica su configuración.

---

## Etapa 3.21 — PWA instalable (configuración entregada; pruebas locales pendientes)

**Punto de partida:** código auditado en `Toco_Madera_Proyecto_Limpio_Revision_3_21.zip`. Los archivos de esta etapa son una **actualización parcial** para aplicar sobre el repositorio local ya respaldado en GitHub; no reemplazar toda la carpeta.

### Infraestructura PWA

- Frontend Angular 22.2.0, TypeScript, Tailwind CSS 4, Flowbite y Chart.js (dashboard). Backend Flask con JWT por rol; MySQL 8.
- `frontend/public/manifest.webmanifest`: nombre Toco Madera, alcance `/`, `display: standalone`, colores crema `#F9E9D5` y nogal `#4B2E1F`.
- `frontend/public/icons/`: iconos oficiales 192 × 192, 512 × 512 y 512 × 512 maskable a partir de `logo-icono.png`.
- `frontend/src/index.html`: referencias al manifest, icono Apple, `theme-color`, título, metadatos y español.
- `frontend/src/app/app.config.ts`: `provideServiceWorker` registrado solo fuera del modo desarrollo.
- `frontend/angular.json`: habilita el worker de Angular en la configuración **production** mediante `serviceWorker: "ngsw-config.json"`.
- `frontend/ngsw-config.json`: guarda en caché el shell y los recursos estáticos; imágenes del catálogo bajo demanda. **No se almacenan respuestas de la API REST privada**, ni JWT, pagos, pedidos, datos personales ni operaciones de ADMIN.
- `frontend/package.json`: agrega `@angular/service-worker` de la misma versión mayor que Angular. Se actualiza `package-lock.json` **mediante `npm install` en el equipo local**, no reemplazarlo sin instalar.

### Instrucciones verificables para Windows

1. En la raíz `toco-madera`, respaldar los 5 archivos que se reemplazan y copiar la carpeta `frontend/` del ZIP de Etapa 3.21. Conservar `backend/`, `database/`, el `.env` local y `.git`.
2. `cd frontend`; `npm install`; `npx ng build --configuration production`. Validar `dist/frontend/browser/ngsw-worker.js`, `dist/frontend/browser/ngsw.json`, `dist/frontend/browser/manifest.webmanifest`.
3. Detener `ng serve` con Ctrl+C; iniciar **servidor estático para la compilación de producción** en el puerto 4200: `npx --yes serve@14 -s dist/frontend/browser -l 4200`. El puerto 4200 coincide con CORS del backend existente. Mantener Flask en `127.0.0.1:5000` y MySQL activos para las operaciones.
4. Abrir `http://localhost:4200` (localhost es contexto seguro para service workers); Chrome DevTools → Application → Manifest / Service Workers: validar manifiesto, iconos y worker activado. Usar menú del navegador `Instalar Toco Madera` si aparece.
5. Offline solo significa que pueden abrirse **archivos ya cacheados**. Catálogo remoto, login, checkout, órdenes, pagos simulados y entregas **requieren Flask/MySQL y conexión**; mostrar error o estado de conexión, no simular guardado exitoso fuera de línea.
6. Probar login ADMIN/CLIENTE, catálogo con fotos ambientadas, fotos limpias en carrito/checkout/Mis pedidos, tres gráficas del dashboard según última versión que el usuario decidió conservar, autorizaciones y entregas. **Sin crear nuevos pedidos de demostración ni movimientos de inventario innecesarios.**
7. `git status`; revisar secretos; `git add frontend/angular.json frontend/package.json frontend/package-lock.json frontend/ngsw-config.json frontend/src/index.html frontend/src/app/app.config.ts frontend/public/manifest.webmanifest frontend/public/icons README.md`; commit + push en rama existente.

### Condiciones y advertencias de entrega

- **PWA ≠ backend offline**: no existe sincronización diferida de operaciones ni almacenamiento fuera de línea de información privada.
- El build local Angular, registro real del service worker, instalación y pruebas de usuario en Chrome **siguen pendientes de confirmación**.
- `ng serve` con configuración de desarrollo **no verifica la instalación PWA**: probar `dist` con servidor HTTP local.
- La app Angular solicita a `http://127.0.0.1:5000`; en otra computadora/teléfono ese host designa el propio dispositivo, no el PC servidor. Para una demostración móvil real harían falta URL accesibles y HTTPS, además de ajustar CORS y configuración de API.
- `README.md` documenta el estado del código, no sustituye exportación SQL ni respaldo MySQL; contraseñas y tokens fuera de Git.
- A petición del usuario, **se conservaron los diseños de las gráficas previos a la propuesta 3.20.5**. No se deben reintroducir cambios al dashboard durante esta etapa.


### Corrección posterior de Etapa 3.20.8

Se registraron `admin_clientes_bp` y `perfil_bp` en `backend/app/__init__.py`; el usuario confirmó que las pantallas funcionan. Pendiente verificar con operaciones reales de edición, cambio de contraseña y baja lógica, y realizar las pruebas integrales en Windows.


## Validación de alta de cliente — Etapa 3.20.8 (ajuste final)

- Nombre completo obligatorio, entre 2 y 120 caracteres.
- Correo electrónico obligatorio, con formato válido y único.
- Teléfono obligatorio de 10 dígitos.
- Contraseña requerida y confirmación coincidente.
- El formulario Angular impide enviar datos incompletos y muestra mensajes junto a nombre, correo y teléfono.
- El backend existente (`AuthService.registrar_cliente`) ya valida nombre, correo, teléfono y contraseña; no se requieren cambios de MySQL.
- La instalación PWA corresponde a la Etapa 3.21, todavía pendiente de comprobar en Windows.
