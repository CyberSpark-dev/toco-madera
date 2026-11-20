"""Toco Madera | Habilitar ADMIN a una cuenta existente desde consola local.

USO (desde backend y con .venv activa):
    python crear_admin.py --correo admin@ejemplo.com

NO crear este comando como endpoint HTTP. Requiere acceso local al backend
con su configuración de conexión MySQL. No guarda ni muestra contraseñas.
"""
import argparse
import sys

from sqlalchemy import MetaData, Table, select, update, func
from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.extensions import db


def promover(correo: str) -> int:
    app = create_app()
    with app.app_context():
        metadata = MetaData()
        usuarios = Table('usuarios', metadata, autoload_with=db.engine)
        roles = Table('roles', metadata, autoload_with=db.engine)

        try:
            # Permite también variantes de mayúsculas en el correo.
            usuario = db.session.execute(
                select(usuarios.c.id_usuario, usuarios.c.nombre,
                       usuarios.c.correo, usuarios.c.activo,
                       usuarios.c.id_rol)
                .where(func.lower(usuarios.c.correo) == correo.lower())
                .with_for_update()
            ).mappings().first()

            rol_admin = db.session.execute(
                select(roles.c.id_rol).where(func.upper(roles.c.nombre) == 'ADMIN')
            ).scalar_one_or_none()

            if rol_admin is None:
                print('ERROR: No existe el rol ADMIN en MySQL.')
                db.session.rollback()
                return 1
            if usuario is None:
                print('ERROR: No existe esa cuenta. Regístrala primero como CLIENTE.')
                db.session.rollback()
                return 1
            if not bool(usuario['activo']):
                print('ERROR: La cuenta está inactiva y no se promoverá.')
                db.session.rollback()
                return 1
            if int(usuario['id_rol']) == int(rol_admin):
                print('Esta cuenta ya tiene el rol ADMIN. No se hicieron cambios.')
                db.session.rollback()
                return 0

            print(f"Cuenta encontrada: {usuario['nombre']} <{usuario['correo']}>")
            print('Esta operación concederá acceso a las funciones administrativas.')
            comprobacion = input(f"Para confirmar escribe exactamente: ADMIN {usuario['correo']}\n> ").strip()
            if comprobacion != f"ADMIN {usuario['correo']}":
                print('Cancelado. No se modificó ninguna cuenta.')
                db.session.rollback()
                return 2

            db.session.execute(
                update(usuarios).where(usuarios.c.id_usuario == usuario['id_usuario'])
                .values(id_rol=rol_admin)
            )
            db.session.commit()
            print('ADMIN habilitado. Cierra sesión y vuelve a iniciar sesión con esa cuenta.')
            return 0
        except SQLAlchemyError:
            db.session.rollback()
            app.logger.exception('Error al promover cuenta a ADMIN')
            print('ERROR: No pudo completarse la actualización. Verifica el backend.')
            return 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Promover una cuenta existente a ADMIN (solo consola).')
    parser.add_argument('--correo', required=True, help='Correo ya registrado en Toco Madera')
    args = parser.parse_args()
    sys.exit(promover(args.correo.strip()))
