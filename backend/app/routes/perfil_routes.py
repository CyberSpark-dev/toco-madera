"""Autogestión del perfil: solo puede editar el propietario del JWT."""
import re
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.extensions import db
from app.models.usuario import Usuario
from app.services.auth_service import AuthService
# La validación pertenece al perfil; no depende de las rutas de administrador.
# Esto permite que administración sea de solo lectura y activación/desactivación.


def _validar_campos(datos, actual):
    """Valida nombre, correo y teléfono sin permitir campos adicionales."""
    if not isinstance(datos, dict):
        return None, 'Se requiere JSON válido.'

    permitidos = {'nombre', 'correo', 'telefono'}
    if not datos or not set(datos).issubset(permitidos):
        return None, 'Solo se pueden modificar nombre, correo y teléfono.'

    nombre = datos.get('nombre', actual.nombre)
    correo = datos.get('correo', actual.correo)
    telefono = datos.get('telefono', actual.telefono or '')

    if not all(isinstance(valor, str) for valor in (nombre, correo, telefono)):
        return None, 'Nombre, correo y teléfono deben ser textos válidos.'

    nombre = nombre.strip()
    correo = correo.strip().lower()
    telefono = telefono.strip()

    if not 2 <= len(nombre) <= 120:
        return None, 'El nombre debe contener entre 2 y 120 caracteres.'
    if len(correo) > 190 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', correo):
        return None, 'Correo inválido.'
    if not re.fullmatch(r'\d{10}', telefono):
        return None, 'El teléfono debe tener 10 dígitos.'

    return {'nombre': nombre, 'correo': correo, 'telefono': telefono}, None

perfil_bp=Blueprint('perfil',__name__,url_prefix='/api/v1/perfil')

def _actual():
    try: uid=int(get_jwt_identity())
    except (ValueError,TypeError): return None
    usuario=db.session.get(Usuario,uid)
    return usuario if usuario and usuario.activo else None

@perfil_bp.get('/')
@jwt_required()
def consultar():
    usuario=_actual()
    if not usuario: return jsonify(success=False,message='Sesión no autorizada.'),401
    return jsonify(success=True,usuario=AuthService.usuario_publico(usuario)),200

@perfil_bp.patch('/')
@jwt_required()
def actualizar():
    usuario=_actual()
    if not usuario: return jsonify(success=False,message='Sesión no autorizada.'),401
    cambios,error=_validar_campos(request.get_json(silent=True),usuario)
    if error: return jsonify(success=False,message=error),400
    for k,v in cambios.items():setattr(usuario,k,v)
    try:
        db.session.commit()
        return jsonify(success=True,message='Perfil actualizado.',usuario=AuthService.usuario_publico(usuario)),200
    except IntegrityError:
        db.session.rollback()
        return jsonify(success=False,message='El correo ya está en uso.'),409
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(success=False,message='No se pudo guardar el perfil.'),500

@perfil_bp.post('/password')
@jwt_required()
def cambiar_password():
    usuario=_actual()
    if not usuario: return jsonify(success=False,message='Sesión no autorizada.'),401
    datos=request.get_json(silent=True)
    if not isinstance(datos,dict): return jsonify(success=False,message='JSON inválido.'),400
    actual=datos.get('password_actual'); nueva=datos.get('password_nueva')
    if not isinstance(actual,str) or not isinstance(nueva,str):
        return jsonify(success=False,message='Las contraseñas son obligatorias.'),400
    if not usuario.verificar_password(actual):
        return jsonify(success=False,message='La contraseña actual es incorrecta.'),400
    if len(nueva)<10 or len(nueva)>128 or not any(c.isalpha() for c in nueva) or not any(c.isdigit() for c in nueva):
        return jsonify(success=False,message='La contraseña nueva requiere 10 a 128 caracteres, letras y números.'),400
    if nueva==actual: return jsonify(success=False,message='La contraseña nueva debe ser diferente.'),400
    usuario.establecer_password(nueva)
    try:
        db.session.commit()
        return jsonify(success=True,message='Contraseña modificada. Vuelve a iniciar sesión.'),200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(success=False,message='No fue posible cambiar la contraseña.'),500
