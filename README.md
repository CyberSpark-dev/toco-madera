# Toco Madera v2.0.0

> Frases que vienen de raíz y se guardan en el corazón

PWA académica para una tienda y taller de artículos artesanales de madera en León, Guanajuato, México.

## Funcionalidades

- **Tienda**. Inicio con carrusel de cuatro fotografías, catálogo dinámico, registro, inicio de sesión y Mi cuenta. Los productos personalizables muestran una vista previa ilustrativa con Great Vibes sobre sus fotografías limpias. El rodillo usa el cuerpo cilíndrico. El texto de grabado se conserva en el carrito, la confirmación y el pedido.
- **Pedidos**. Carrito asociado al cliente, checkout, pagos simulados con anticipo del 50 % o pago total, consulta de saldo y seguimiento de entrega. Se puede cancelar un pedido propio confirmado antes de que exista una orden de producción, reserva activa o entrega. La autorización del taller por sí sola conserva esa opción. Los pagos quedan en el historial sin devolución.
- **Administración**. Dashboard, clientes, productos, materias primas, inventario, proveedores, compras, recetas, pedidos y autorizaciones, y producción y entregas. Las compras asistidas consultan los faltantes, permiten preparar y editar borradores y registran la entrada de inventario al recibir los materiales.
- **PWA**. Botón «Instalar Toco Madera», manifiesto con iconos normales y enmascarable, y Service Worker en producción. Se guardan recursos estáticos. El catálogo actualizado y las operaciones requieren acceso a Flask y MySQL.

## Arquitectura y requisitos

| Capa | Componentes |
| --- | --- |
| Navegador | Angular 22 standalone, Angular Router, Signals, Tailwind CSS 4, Flowbite 4, Chart.js y Angular Service Worker |
| API local | Python 3.11.9, Flask con Blueprints, Flask-SQLAlchemy, PyMySQL y JWT |
| Datos | MySQL 8. La instancia de desarrollo se verificó con 8.4.8 |

Angular sirve la tienda y el layout administrativo en `localhost:4200`. Flask atiende `http://127.0.0.1:5000/api/v1` y comprueba los roles de cliente y administrador. Node.js 24.20.0 y npm 11.19.0 se usaron para la validación local.

## Inicio local en Windows

1. Configura MySQL con un esquema verificado. Para una instalación nueva consulta [la guía de base de datos](database/README.md). Utiliza un usuario de aplicación con permisos sobre el esquema correspondiente.
2. Copia `backend/.env.example` como `backend/.env` si el archivo local aún no existe. Genera una clave aleatoria local y configura estos valores con tus propias credenciales.

```dotenv
SECRET_KEY=CLAVE_ALEATORIA_GENERADA_LOCALMENTE
DATABASE_URL=mysql+pymysql://USUARIO:CONTRASENA@127.0.0.1:3306/toco_madera?charset=utf8mb4
```

Conserva `.env`, tokens y respaldos con datos fuera del control de versiones. Flask utiliza `SECRET_KEY` para firmar los JWT. Codifica los caracteres reservados de la contraseña al construir la URL.

Desde la raíz, inicia Flask y deja la terminal abierta.

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

Comprueba `http://127.0.0.1:5000/api/v1/health`. En otra terminal, desde la raíz:

```powershell
cd frontend
npm.cmd ci
npm.cmd start
```

Abre `http://localhost:4200/`. Las rutas de cliente incluyen `/cliente/carrito`, `/cliente/checkout`, `/cliente/mis-pedidos` y `/cliente/mi-cuenta`. La administración comienza en `/admin/dashboard`. El router completo se encuentra en `frontend/src/app/app.routes.ts`.

## Pruebas y compilación

Desde `frontend`:

```powershell
npx.cmd ng test --watch=false
npx.cmd ng build --configuration production
```

Desde `backend`:

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests -p '*unidad.py'
```

Para integración con escrituras usa exclusivamente una copia MySQL identificada y certificada, con cuenta de pruebas limitada. Consulta [el procedimiento de compras asistidas](docs/COMPRAS-ASISTIDAS-PRUEBAS.md). Los respaldos con registros deben permanecer en una carpeta privada, y toda restauración se ensaya primero en un destino aislado.

## Instalación PWA y demostración en Android

Sirve la compilación de `frontend/dist/frontend/browser` en `localhost:4200`, con fallback a `index.html` para rutas Angular. Por ejemplo, desde `frontend`, con el servidor de desarrollo detenido:

```powershell
npx.cmd --yes serve@14 -s dist/frontend/browser -l tcp://127.0.0.1:4200
```

En Chrome comprueba el manifiesto y el Service Worker en **DevTools → Application**. En Android físico usa depuración USB, verifica `adb devices` y reenvía los puertos locales:

```powershell
adb reverse tcp:4200 tcp:4200
adb reverse tcp:5000 tcp:5000
```

Abre `http://localhost:4200/` en Chrome del teléfono. Pulsa **Instalar Toco Madera** o usa la opción de Chrome si el navegador ofrece solo la vía manual. Comprueba el icono y la apertura en modo independiente. [Guía de PWA y grabado](docs/INSTALACION-PWA-Y-ESTILOS.md).

## Límites y pendientes

- Los pagos y las liquidaciones son simulados. Las cancelaciones conservan el historial sin devolución.
- La instalación se prueba con la compilación de producción en localhost. Para un despliegue eventual hacen falta HTTPS y una configuración de API apropiada para el dominio. La instalación y el recorrido integral en un Android físico siguen pendientes.
- Los importes de producto, pedido y pago usan centavos. Los costos unitarios de materiales y las cantidades pueden requerir cuatro decimales. La interfaz muestra importes en MXN a dos decimales y las aproximaciones físicas conservan aviso cuando corresponde.
- El histórico contiene fracciones con unidad `PZA`. Su normalización exige revisar la unidad real del material y su efecto en recetas y movimientos. El catálogo aplica la descripción vigente del rodillo al texto inicial legado al leerlo. Las descripciones editadas permanecen disponibles tal como se guardaron.
- Los subtotales del carrito son estimaciones. Flask verifica el precio vigente y calcula el importe definitivo con `Decimal`.

Consulta la [entrega de v2.0.0](docs/ENTREGA-v2.0.0.md), los [pendientes de la versión](docs/PENDIENTES-v1.1.md) y la [referencia del carrusel](docs/ESCENAS-INICIO.md).

**Equipo:** Angel Torres, Braulio Ríos, Arturo Landeros y Emiliano Barajas.
