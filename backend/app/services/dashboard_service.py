
class DashboardService:
    """
    Servicio de estadísticas de Toco Madera.

    Durante la Etapa 1 no consulta la base
    de datos. Solo confirma que el módulo
    ha sido inicializado.
    """

    @staticmethod
    def obtener_estado():

        return {
            "success": True,
            "module": "dashboard",
            "message": "Blueprint disponible",
            "database_connected": False,
            "statistics_ready": False
        }
