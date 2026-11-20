"""API de costos base de materiales, independiente del CRUD existente.
Registrar este Blueprint una sola vez en create_app().
"""
from decimal import Decimal, InvalidOperation
from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.extensions import db
from app.utils.permisos import admin_required

admin_costos_materiales_bp = Blueprint(
    'admin_costos_materiales', __name__, url_prefix='/api/v1/admin/costos-materiales'
)

@admin_costos_materiales_bp.get('/')
@admin_required
def listar_costos_base():
    try:
        filas = db.session.execute(text('''SELECT id_material, sku, nombre, costo_base
                                          FROM materiales ORDER BY nombre''')).mappings().all()
        return jsonify({'success': True, 'costos': [
            {'id_material': f['id_material'], 'sku': f['sku'], 'nombre': f['nombre'],
             'costo_base': str(f['costo_base']) if f['costo_base'] is not None else None}
            for f in filas
        ]}), 200
    except SQLAlchemyError:
        current_app.logger.exception('Error consultando costos base')
        db.session.rollback()
        return jsonify({'success':False,'message':'No fue posible consultar los costos base.'}), 500

@admin_costos_materiales_bp.put('/<int:id_material>')
@admin_required
def actualizar_costo_base(id_material):
    datos = request.get_json(silent=True)
    if not isinstance(datos, dict) or isinstance(datos.get('costo_base'), bool):
        return jsonify({'success':False,'message':'Costo base obligatorio.'}), 400
    try:
        valor = Decimal(str(datos.get('costo_base')))
    except (InvalidOperation, ValueError, TypeError):
        return jsonify({'success':False,'message':'Costo base no válido.'}), 400
    if not valor.is_finite() or valor <= 0 or valor > Decimal('9999999999.9999') or valor.as_tuple().exponent < -4:
        return jsonify({'success':False,'message':'El costo debe ser positivo y admitir máximo 4 decimales.'}), 400
    try:
        material = db.session.execute(text('''SELECT id_material FROM materiales
                                               WHERE id_material = :id FOR UPDATE'''),
                                      {'id': id_material}).mappings().first()
        if material is None:
            db.session.rollback()
            return jsonify({'success':False,'message':'Material no encontrado.'}), 404
        db.session.execute(text('''UPDATE materiales SET costo_base = :costo
                                   WHERE id_material = :id'''), {'costo':valor,'id':id_material})
        db.session.commit()
        return jsonify({'success':True,'id_material':id_material,'costo_base':str(valor)}), 200
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception('Error guardando costo base')
        return jsonify({'success':False,'message':'No fue posible actualizar el precio base.'}),500
