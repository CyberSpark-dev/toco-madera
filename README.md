# Toco Madera

> **Frases que vienen de raíz y se graban en el corazón.**

PWA académica para transformar materias primas en seis productos artesanales de madera personalizados y administrar su comercialización en León, Guanajuato, México.

## Estado del proyecto (17 de noviembre de 2026)

- **Etapa 1:** estructura Angular + Flask, dashboard visual con Chart.js y comprobación de comunicación HTTP.
- **Etapa 2.1–2.5:** servidor MySQL 8, base `toco_madera` y conexión de Flask a MySQL comprobada localmente.
- **Etapa 2.6:** esquema SQL y documentación **preparados para ser ejecutados y verificados** en Workbench. No se afirma que las tablas estén instaladas aún.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Angular 22, TypeScript, Tailwind CSS 4, Flowbite 4 |
| Dashboard | Chart.js 4, datos reales desde API al terminar la integración |
| Backend | Python 3.11.9, Flask, Blueprints, Application Factory, Flask-CORS |
| Datos | MySQL 8, Flask-SQLAlchemy, PyMySQL |
| Control de versiones | Git y GitHub con SSH |

**Fuera de alcance:** Flutter, Android, pasarelas de cobro real. El panel administrativo **sí requiere** estadísticas y gráficas funcionales basadas en registros de MySQL.

## Productos

1. Portateléfonos
2. Marcos fotográficos
3. Rodillos de cocina (materiales y acabados aptos para contacto alimentario)
4. Repisas
5. Portallaves
6. Placas de escritorio

## Mapa del repositorio

```text
toco-madera/
├── frontend/                   # PWA Angular: cliente y administración
├── backend/                    # API Flask con Blueprints
│   ├── app/
│   │   ├── routes/             # Endpoints HTTP
│   │   ├── services/           # Reglas de negocio
│   │   ├── models/             # Modelos SQLAlchemy (pendientes)
│   │   └── __init__.py         # create_app()
│   ├── .env.example
│   ├── requirements.txt
│   └── run.py
├── database/
│   ├── 01_crear_base_datos.sql # Script previo ya agregado por el equipo
│   ├── 01_schema.sql           # 25 tablas y 4 vistas
│   ├── 02_seed.sql             # Catálogos y 6 productos DEMOSTRATIVOS
│   ├── 03_verificaciones.sql   # Validaciones de instalación
│   └── 04_prueba_transaccion_rollback.sql
├── docs/
│   └── Requerimientos_Toco_Madera_v3_0.docx
└── README.md
```

## Arranque local

### 1. Clonar

```powershell
git clone git@github-school:IEVN1002-22000313/toco-madera.git
cd toco-madera
```

El alias `github-school` debe existir en la configuración SSH del desarrollador. Otros integrantes pueden clonar usando la dirección SSH o HTTPS de su propia cuenta autorizada.

### 2. Frontend (terminal A)

```powershell
cd frontend
npm ci
npm start
```

Abrir `http://localhost:4200` y `http://localhost:4200/admin/dashboard`.

### 3. Backend (terminal B)

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python run.py
```

Abrir `http://127.0.0.1:5000/api/v1/health` y `/api/v1/dashboard/status`.

Crear `backend/.env` individualmente según `.env.example`; **no subir secretos**. Para conectar MySQL, configurar `DATABASE_URL=mysql+pymysql://USUARIO:CLAVE@localhost:3306/toco_madera?charset=utf8mb4`. Si la contraseña contiene caracteres reservados en URL, codificarlos o construir la conexión mediante `URL.create()`.

### 4. Base de datos (Workbench)

Con MySQL 8 disponible, respaldar cualquier dato previo. En este orden, **solo para una instalación nueva**:

1. Ejecutar `database/01_schema.sql` (crea esquema, tablas, claves, restricciones y vistas).
2. Ejecutar `database/02_seed.sql` una sola vez **si se desean datos de catálogo de demostración**. Incluye precios referenciales, no transacciones reales.
3. Ejecutar `database/03_verificaciones.sql`.
4. Opcional: `database/04_prueba_transaccion_rollback.sql` para practicar transacciones reversibles.

No ejecutar `02_seed.sql` reiteradamente: tiene IDs explícitos y generará duplicados. El usuario de Flask (`toco_app`) tiene SELECT/INSERT/UPDATE/DELETE; ejecutar DDL con una cuenta administradora desde Workbench.

## Reglas esenciales

- Cliente y administrador tienen permisos distintos; todas las rutas administrativas requieren autenticación y rol ADMIN.
- Personalización por pedido: un artículo genérico en stock no equivale a un grabado terminado.
- Pago simulado: opción de anticipo del 50 % o pago completo; el saldo se liquida al entregar.
- Registros de inventario por movimientos; nunca inventar stock a partir de cotizaciones.
- Dashboard obligatorio: ventas confirmadas, productos más vendidos, clientes, pedidos por estado, inventario crítico y saldos; no duplicar ingresos al sumar anticipos y ventas.
- Operaciones críticas (compra recibida, producción terminada, entrega) requieren transacciones y validaciones en Flask.
- Cifrar contraseñas de usuarios con hash seguro; nunca guardar contraseñas en texto plano.

## Pruebas y estado

```powershell
# Frontend
cd frontend
npx ng build

# Backend
cd ..\backend
python -m compileall app run.py
```

La ejecución de SQL y las pruebas funcionales con transacciones reales deben comprobarse localmente antes de declarar la Etapa 2.6 completada.

## Trabajo colaborativo

Cuatro integrantes, diez días de trabajo incluyendo pruebas. Trabajar en ramas `feature/...` y solicitar revisión mediante Pull Requests antes de integrar en `main`. Nunca publicar `.env`, credenciales, `.venv/` o `node_modules/`.

## Documentación

El documento `docs/Requerimientos_Toco_Madera_v3_0.docx` describe el alcance actual, funcionalidades, reglas de negocio, requisitos no funcionales y criterios de aceptación. Las estimaciones de precios y fechas deben validarse antes de presentarlas como datos comerciales reales.

**Proyecto académico; no procesa pagos verdaderos.**
