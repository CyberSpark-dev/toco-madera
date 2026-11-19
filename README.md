# Toco Madera

> **«Frases que vienen de raíz y se graban en el corazón.»**

**Toco Madera** es una aplicación web progresiva (PWA) académica orientada a una empresa de transformación artesanal de madera en León, Guanajuato, México. Permite ofrecer productos de madera personalizables a clientes y centralizar, mediante un panel protegido, las operaciones administrativas del negocio.

**Estado de desarrollo:** Etapa **3.16** cerrada tras la validación manual de diez pruebas del CRUD de materiales en entorno local. La aplicación está **en desarrollo** y no debe considerarse lista para producción.

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

Esta estructura reúne las rutas y componentes **conocidos hasta la Etapa 3.16**. Es una referencia de los archivos trabajados; el repositorio puede contener otros módulos, modelos, archivos SQL y recursos.

```text
toco-madera/
├── README.md
├── backend/
│   ├── run.py
│   ├── requirements.txt                 # Si existe en el repositorio
│   ├── scripts/
│   │   └── crear_admin.py
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
│       │   └── admin_material_routes.py
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
            │   └── inicio/             # inicio.ts, inicio.html, inicio.css
            ├── core/
            │   ├── guards/admin.guard.ts
            │   ├── interceptors/auth.interceptor.ts
            │   └── services/
            │       ├── api.ts
            │       ├── auth.ts
            │       ├── admin-productos.ts
            │       ├── admin-proveedores.ts
            │       └── admin-materiales.ts
            └── admin/
                ├── dashboard/          # dashboard.ts, dashboard.html, dashboard.css
                ├── productos/          # productos.ts, productos.html, productos.css
                ├── proveedores/        # proveedores.ts, proveedores.html, proveedores.css
                └── materiales/         # materiales.ts, materiales.html, materiales.css
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

El guard `adminGuard` protege la navegación hacia `/admin/dashboard`, `/admin/productos`, `/admin/proveedores` y `/admin/materiales`. La API aplica una comprobación adicional del rol en el servidor.

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
13. Las operaciones de alta/edición de materiales no insertan entradas ni salidas en `movimientos_material`. Estas transacciones corresponden a un módulo posterior.
14. Los materiales y proveedores pueden desactivarse sin eliminar físicamente registros asociados a compras, cotizaciones o producción.
15. Para pedidos personalizados se contempla un anticipo del **50 %** y liquidación contra entrega, o pago completo al realizar el pedido. La pasarela/pago es **simulado** en el alcance académico previsto.
16. Los pedidos grandes requieren un plazo de fabricación/entrega, mientras que los productos ya disponibles pueden entregarse antes, según existencias y operación.

Las reglas de pedidos, anticipos e inventario están documentadas como **alcance funcional previsto**; no deben confundirse con módulos ya implementados.

## 10. Estado de los módulos al cierre de la Etapa 3.16

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
| Compras y recepción de materiales | Pendiente |
| Existencias, movimientos, alertas y reservas | Pendiente |
| Recetas/listas de materiales y órdenes de producción | Pendiente |
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

## 11. Pruebas manuales realizadas / a mantener

### Autenticación y navegación

- Registrar un cliente y comprobar que accede al catálogo.
- Iniciar sesión como administrador y entrar al dashboard.
- Cerrar sesión y comprobar que una ruta administrativa redirige al login.
- Intentar consultar un endpoint protegido sin JWT y verificar una respuesta de rechazo.

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
- Crear administradores únicamente mediante el procedimiento administrativo autorizado (`backend/scripts/crear_admin.py`).
- No confiar en las validaciones de Angular como única protección: Flask debe validar nuevamente todos los campos.
- La sesión Angular actual mantiene el JWT **en memoria**; al recargar la pestaña puede requerirse iniciar sesión otra vez.
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
git commit -m "feat: completar etapa 3.16 proveedores y materiales"
git push origin main
```

Revisar siempre `git status` y `git diff --cached` antes del commit para asegurar que no se incluyan secretos, archivos temporales ni el entorno virtual.

## 14. Próximas etapas

1. Compras y recepción de materiales (siguiente etapa sugerida: **3.17**).
2. Inventarios, movimientos, existencias y alertas.
3. Recetas/listas de materiales y órdenes de producción.
4. Pedidos, personalización, carrito y pagos simulados.
5. Indicadores reales y gráficas desde MySQL.
6. Pruebas integrales, accesibilidad, seguridad, PWA y preparación de entrega.

El orden exacto puede ajustarse según dependencias y prioridades del equipo, manteniendo la arquitectura Angular + Flask + MySQL.

## 15. Historial de hitos

| Etapa | Resumen |
|---|---|
| 3.13 | Backend Flask, MySQL, modelos y autenticación base |
| 3.14 | Integración de login/registro Angular, JWT, guard, dashboard y cierre de sesión |
| **3.15** | **CRUD administrativo de productos: consulta, categorías, alta, edición, búsqueda, filtros y cambio de estado; validación funcional completada** |
| **3.16** | **Proveedores y materias primas: CRUD protegido, formularios Angular, unidad de medida, validaciones de stock mínimo y diez pruebas confirmadas del módulo materiales** |

---

**Política de documentación:** al terminar cada etapa numerada completa se actualiza **todo este README general**, con información verificable sobre funcionalidades terminadas, pruebas realizadas y pendientes. No se documentan como concluidos módulos aún no construidos.

**Proyecto académico — Toco Madera, León, Guanajuato, México.**

**Actualización documental:** 19 de noviembre de 2026 — cierre de la Etapa 3.16.
