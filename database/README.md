# Base de datos — Toco Madera

## Requisitos

- MySQL Server 8.
- MySQL Workbench.
- Python 3.11.9.
- Flask, Flask-SQLAlchemy y PyMySQL.

## Configuración inicial

1. Abrir MySQL Workbench.
2. Conectarse al servidor MySQL local.
3. Ejecutar `01_crear_base_datos.sql`.
4. Crear un usuario técnico para Flask con permisos sobre `toco_madera`.
5. Configurar la variable `DATABASE_URL` en `backend/.env`.
6. Verificar que Flask pueda consultar `SELECT DATABASE()`.

## Variables de entorno

La configuración local debe incluir:

```dotenv
SECRET_KEY=CLAVE_GENERADA_LOCALMENTE
DATABASE_URL=mysql+pymysql://USUARIO:CONTRASENA@localhost:3306/toco_madera?charset=utf8mb4
```

**Importante:** no subir a GitHub las contraseñas reales ni el archivo `.env`.

## Estado actual

La base de datos `toco_madera` está creada y se ha comprobado la conexión desde Flask utilizando SQLAlchemy.

Las tablas, claves foráneas, relaciones y datos iniciales se incorporarán durante la Etapa 2.6.
