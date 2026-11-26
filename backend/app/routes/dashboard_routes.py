"""Toco Madera — Estadísticas REALES desde MySQL; solo ADMIN.

Las "ventas" son valores de pedidos aceptados en el escenario académico,
NO cobros bancarios. Los pagos ficticios se miden por separado.
"""
from datetime import date, timedelta
from decimal import Decimal
from flask import Blueprint, jsonify, current_app
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.extensions import db
from app.utils.permisos import admin_required
from app.services.dashboard_service import DashboardService

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/v1/dashboard')

ESTADOS_COMERCIALES = ('CONFIRMADO', 'EN_PRODUCCION', 'LISTO', 'ENTREGADO')

@dashboard_bp.get('/status')
@admin_required
def estado_dashboard():
    return jsonify(DashboardService.obtener_estado()), 200

@dashboard_bp.get('/estadisticas')
@admin_required
def estadisticas():
    """Una sola respuesta alimenta 4 KPI y 3 gráficas de Chart.js."""
    try:
        # La subconsulta de detalles evita duplicar monto_envio/descuento
        # cuando un pedido contiene múltiples productos.
        filas_diarias = db.session.execute(text("""
            SELECT DATE(p.fecha) AS dia,
                   COALESCE(SUM(t.importe + p.monto_envio - p.descuento),0) AS monto
            FROM pedidos p
            INNER JOIN (
                SELECT d.id_pedido,
                       SUM(d.cantidad * d.precio_unitario_acordado) AS importe
                FROM pedido_detalles d GROUP BY d.id_pedido
            ) t ON t.id_pedido=p.id_pedido
            WHERE p.estado IN ('CONFIRMADO','EN_PRODUCCION','LISTO','ENTREGADO')
              AND p.fecha >= CURDATE() - INTERVAL 6 DAY
              AND p.fecha < CURDATE() + INTERVAL 1 DAY
            GROUP BY DATE(p.fecha)
            ORDER BY DATE(p.fecha)
        """)).mappings().all()
        mapa_dias = {str(f['dia']): float(f['monto'] or 0) for f in filas_diarias}
        # Días en zona horaria del MySQL local. El frontend no recalcula importes.
        hoy = db.session.execute(text('SELECT CURDATE()')).scalar_one()
        ventas = [{'fecha': (hoy - timedelta(days=i)).isoformat(),
                   'monto': round(mapa_dias.get((hoy - timedelta(days=i)).isoformat(), 0.0),2)}
                  for i in range(6,-1,-1)]

        filas_estado = db.session.execute(text("""
            SELECT estado, COUNT(*) AS cantidad
            FROM pedidos GROUP BY estado ORDER BY estado
        """)).mappings().all()
        estados = [{'estado': f['estado'], 'cantidad': int(f['cantidad'])} for f in filas_estado]

        # Agrupación a nivel de productos. Pedidos cancelados y sin anticipo
        # confirmado NO cuentan como unidades vendidas.
        filas_producto = db.session.execute(text("""
            SELECT d.id_producto, COALESCE(pr.nombre, CONCAT('Producto #', d.id_producto)) AS nombre,
                   SUM(d.cantidad) AS unidades
            FROM pedido_detalles d
            INNER JOIN pedidos p ON p.id_pedido = d.id_pedido
            LEFT JOIN productos pr ON pr.id_producto = d.id_producto
            WHERE p.estado IN ('CONFIRMADO','EN_PRODUCCION','LISTO','ENTREGADO')
            GROUP BY d.id_producto, pr.nombre
            ORDER BY unidades DESC, nombre ASC
            LIMIT 10
        """)).mappings().all()
        productos = [{'id_producto': int(f['id_producto']), 'nombre': f['nombre'],
                      'unidades': int(f['unidades'])} for f in filas_producto]

        # Suma de pedidos comerciales vigentes, no de pagos bancarios.
        total_ventas = db.session.execute(text("""
            SELECT COALESCE(SUM(t.importe + p.monto_envio - p.descuento),0)
            FROM pedidos p
            INNER JOIN (
                SELECT id_pedido, SUM(cantidad * precio_unitario_acordado) AS importe
                FROM pedido_detalles GROUP BY id_pedido
            ) t ON t.id_pedido=p.id_pedido
            WHERE p.estado IN ('CONFIRMADO','EN_PRODUCCION','LISTO','ENTREGADO')
        """)).scalar_one()
        pendientes = db.session.execute(text("""
            SELECT COUNT(*) FROM pedidos
            WHERE estado IN ('PENDIENTE_ANTICIPO','CONFIRMADO','EN_PRODUCCION','LISTO')
        """)).scalar_one()
        # Para evitar suponer la estructura de roles/usuarios, este KPI
        # contabiliza compradores distintos, NO cuentas registradas totales.
        compradores = db.session.execute(text("""
            SELECT COUNT(DISTINCT id_cliente) FROM pedidos
        """)).scalar_one()
        unidades = db.session.execute(text("""
            SELECT COALESCE(SUM(d.cantidad),0) FROM pedido_detalles d
            INNER JOIN pedidos p ON p.id_pedido=d.id_pedido
            WHERE p.estado IN ('CONFIRMADO','EN_PRODUCCION','LISTO','ENTREGADO')
        """)).scalar_one()
        cobrado = db.session.execute(text("""
            SELECT COALESCE(SUM(monto),0) FROM pagos
            WHERE estado='APROBADO_SIMULADO'
              AND id_pedido IN (
                SELECT id_pedido FROM pedidos
                WHERE estado IN ('CONFIRMADO','EN_PRODUCCION','LISTO','ENTREGADO')
              )
        """)).scalar_one()

        return jsonify(success=True, periodo='ultimos_7_dias',
                       nota='Importes de pedidos y pagos exclusivamente simulados; no son cobros reales.',
                       kpis={'ventas_confirmadas': round(float(total_ventas or 0),2),
                             'pedidos_pendientes': int(pendientes or 0),
                             'clientes_compradores': int(compradores or 0),
                             'unidades_vendidas': int(unidades or 0),
                             'pagos_simulados_aprobados': round(float(cobrado or 0),2)},
                       ventas_por_dia=ventas, pedidos_por_estado=estados,
                       productos_mas_vendidos=productos), 200
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception('No fue posible cargar las estadísticas.')
        return jsonify(success=False, message='No pudimos consultar las estadísticas. Intenta nuevamente.'), 500
