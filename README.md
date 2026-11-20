# Toco Madera

> **«Frases que vienen de raíz y se graban en el corazón.»**

**Toco Madera** es una aplicación web progresiva (PWA) académica orientada a una empresa de transformación artesanal de madera en León, Guanajuato, México. Permite ofrecer productos de madera personalizables a clientes y centralizar, mediante un panel protegido, las operaciones administrativas del negocio.

**Estado de desarrollo (19 de noviembre de 2026):** Etapa **3.17** cerrada. El desarrollador confirmó las pruebas manuales de compras/recepción, inventario/movimientos y las diez verificaciones de recetas. Las etapas **3.18–3.21 están pendientes**. La aplicación está **en desarrollo** y no debe considerarse lista para producción.

## 1. Objetivo y alcance

El sistema modela la compra de materias primas, su transformación en artículos de madera y su venta al cliente. Incluye una interfaz pública y una interfaz administrativa. El proyecto está desarrollado por un equipo de cuatro integrantes, con una planificación académica de diez días de implementación y pruebas.

La plataforma contempla catálogo, registro e inicio de sesión, personalización por grabado, carrito, pedidos, simulación de pagos, proveedores, compras, materiales, inventario y producción. **No todos estos módulos están terminados:** consulta la sección «Estado de los módulos».

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

Esta estructura reúne las rutas y componentes **desarrollados hasta la Etapa 3.18**. Es una referencia de los archivos trabajados; el repositorio puede contener otros módulos, modelos, archivos SQL y recursos.

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

El guard `adminGuard` protege la navegación hacia `/admin/dashboard`, `/admin/productos`, `/admin/proveedores` , `/admin/materiales`, `/admin/compras`, `/admin/inventario` y `/admin/recetas`. La API aplica una comprobación adicional del rol en el servidor.

## 8. Endpoints REST implementados o preparados

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

**Advertencia:** el costo de proceso mostrado en Angular es mano de obra más indirectos, no costo integral de producción; para este último faltan valoración y consumo de materiales. La Etapa 3.19 deberá conservar la versión específica de receta utilizada por cada orden de fabricación.

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
20. Los flujos de pedidos, pago simulado y consumo en producción permanecen **pendientes** y deben usar transacciones atómicas, controles de stock y estados válidos.

Las reglas de pedidos y anticipos se documentan como **alcance previsto**, no como módulos terminados. La lectura de inventario y recetas sí fue desarrollada en la Etapa 3.17.

## 10. Estado de los módulos: 3.18 cerrada, 3.19 en inicio

| Módulo o capacidad | Estado al cierre |
|---|---|
| Estructura Angular 22 + Tailwind CSS 4 + Flowbite | Implementada |
| Backend Flask + Blueprints + conexión MySQL | Implementado |
| Base relacional y catálogo inicial de seis productos | Cargados en fases previas |
| Catálogo público | Implementado |
| Registro y login de clientes y administrador | Implementados |
| JWT, roles, guard Angular, interceptor y decorador de permisos | Implementados |
| Dashboard administrativo | Funcional; indicadores comerciales aún provisionales |
| Gráfica semanal con Chart.js | Visible, datos de ejemplo |
| Cierre de sesión local | Implementado |
| CRUD de productos, categorías, búsqueda y filtros | **Etapa 3.15: validada** |
| CRUD de proveedores, búsqueda y filtros | **Etapa 3.16: implementado; registro comprobado** |
| CRUD de materias primas y selector de unidades | **Etapa 3.16: diez pruebas funcionales confirmadas** |
| Carrito, personalización y pago simulado | Pendiente de integración completa |
| Pedidos e historial del cliente | Pendiente |
| Compras, registro de detalles y recepción | **Etapa 3.17: validada manualmente** |
| Existencias, movimientos y alertas de materiales | **Etapa 3.17: validada manualmente** |
| Reservas de producto e inventario terminado | Pendiente de integrar con pedidos/producción |
| Recetas, ingredientes y versionado | **Etapa 3.17: diez pruebas confirmadas** |
| Órdenes de producción y consumos de materiales | Pendiente, Etapa 3.19 |
| Estadísticas reales desde MySQL | Pendiente |
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
- El botón «Cerrar sesión» limpia la sesión local; **no implementa revocación del JWT en el servidor**. La revocación y la gestión robusta de sesiones quedan pendientes para un entorno productivo.
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

No utilizar `git init`, `git remote rename` ni `git push --force` para la publicación ordinaria. Antes de registrar una etapa:

```powershell
# Desde la raíz del repositorio
git status
git add README.md backend frontend
git commit -m "feat: cerrar etapa 3.18 carrito pedidos pagos simulados y roles"
git push origin main
```

Revisar siempre `git status` y `git diff --cached` antes del commit para asegurar que no se incluyan secretos, archivos temporales ni el entorno virtual.

## 14. Cierre de la Etapa 3.18 y ruta de la Etapa 3.19

### 14.1. Etapa 3.18 — Cliente, pedidos y pagos simulados (validada por el equipo)

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

**Pruebas confirmadas en conversación:** navegación, login y persistencia de sesión, carrito, checkout de tarjeta/transferencia ficticias, guardado de métodos demo, cierre de sesión, roles y consulta de pedidos. La compilación y resultados de cada estación dependen del repositorio local del equipo. No afirmar que exista una pasarela de pago real, tokenización bancaria o un despliegue productivo.

### 14.2. Etapa 3.19 — Producción y entregas (en inicio)

**3.19.1 Diagnóstico y contrato:** obtener estructura *vigente* de `ordenes_produccion`, `consumos_produccion`, `movimientos_material`, `movimientos_producto`, `lotes_producto`, `reservas_producto`, `entregas`, recetas y existencias; revisar llaves, vistas e índices. Usar `docs/sql/diagnostico_etapa_3_19.sql` del paquete de inicio. **No ejecutar DDL sobre la base ni sustituir el esquema vigente por `schema.sql` de diseño**, ya que sus definiciones antiguas de entregas difieren del esquema reportado por MySQL.

**3.19.2 Backend de producción:** endpoints ADMIN para listar, planificar, iniciar y finalizar órdenes vinculadas a `pedido_detalles` y a una `receta` versionada; estados reales `PLANIFICADA`, `EN_PROCESO`, `FINALIZADA`, `CANCELADA` sujetos a transiciones válidas.

**3.19.3 Consumo atómico:** calcular `receta_materiales.cantidad × ordenes_produccion.cantidad`, comprobar existencias y bloquear filas cuando el esquema lo permita, escribir `consumos_produccion` y `movimientos_material` negativos con `tipo='CONSUMO'` dentro de una única transacción; nunca descontar dos veces una orden finalizada o iniciada.

**3.19.4 Producto terminado:** finalizar órdenes, registrar lotes y `movimientos_producto` de producción; atender cantidades de `tipo_surtido='FABRICACION'` y reservas de unidades en existencia cuando estén respaldadas por las tablas reales.

**3.19.5 Entregas y saldo:** programar o concluir entregas mediante `entregas`, verificar `vw_saldos_pedidos.saldo`, gestionar únicamente pagos simulados de liquidación y cambiar pedidos a `LISTO`/`ENTREGADO` solo después de las validaciones de negocio. No marcar entregado si quedan requisitos pendientes.

**3.19.6 Angular y pruebas:** interfaz administrativa para órdenes y entregas, prueba con pedidos reales de la Etapa 3.18, reconstrucción de existencias y validación de rollback e idempotencia.

**Regla de integridad:** el estado del pedido, el estado de la orden, los movimientos de material, los lotes, las reservas, las entregas y los saldos no son intercambiables. Ninguna operación debe considerar un pago simulado como prueba de entrega física.

### 14.3. Etapa 3.20 — Integración y estadísticas reales

Consolidar flujo de cliente y administrador y sustituir los ceros provisionales de KPI/Chart.js por estadísticas provenientes de consultas reales de Flask y MySQL. Conservar permisos, navegación y roles.

### 14.4. Etapa 3.21 — PWA, pruebas y entrega

Verificar `manifest`, service worker, instalación, rutas offline seguras, iconos, `ng build`, permisos, JWT, operaciones transaccionales e instrucciones de puesta en marcha. Cerrar el README completo y entregar el proyecto académico.

## 15. Historial de hitos

| Etapa | Resumen |
|---|---|
| 3.13 | Backend Flask, MySQL, modelos y autenticación base |
| 3.14 | Integración de login/registro Angular, JWT, guard, dashboard y cierre de sesión |
| **3.15** | **CRUD administrativo de productos: consulta, categorías, alta, edición, búsqueda, filtros y cambio de estado; validación funcional completada** |
| **3.16** | **Proveedores y materias primas: CRUD protegido, formularios Angular, unidad de medida, validaciones de stock mínimo y diez pruebas confirmadas del módulo materiales** |
| **3.17** | **Compras y recepción, existencias y movimientos, recetas versionadas: desarrollo y pruebas manuales confirmadas** |
| **3.18** | **Catálogo, carrito, checkout, pedidos, pagos ficticios (transferencia/tarjeta), métodos demo guardados, roles y confirmaciones de logout: pruebas del usuario completadas** |
| **3.19** | **Iniciada: diagnóstico de esquema productivo, luego órdenes, consumo, lotes, entregas y saldo** |
| 3.20–3.21 | Pendientes: estadísticas reales, integración, PWA y entrega |

---

**Política de documentación:** al terminar cada etapa numerada completa se actualiza **todo este README general**, con información verificable sobre funcionalidades terminadas, pruebas realizadas y pendientes. No se documentan como concluidos módulos aún no construidos.

**Proyecto académico — Toco Madera, León, Guanajuato, México.**

**Actualización documental:** 20 de noviembre de 2026 — cierre funcional de la **Etapa 3.18** e inicio del diagnóstico de la **Etapa 3.19**.
