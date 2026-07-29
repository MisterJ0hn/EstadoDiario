"""Importar cualquier submódulo de app.models (ej. `from app.models.usuario
import Usuario`) ejecuta este __init__ primero, lo que registra TODOS los
modelos en el registry de SQLAlchemy. Sin esto, un proceso que solo importa
un modelo puntual (como los jobs en app/jobs/, que corren fuera de FastAPI y
nunca pasan por app/main.py) falla al resolver relationship("Usuario", ...)
u otras relaciones expresadas como string, porque esas clases todavía no se
cargaron.
"""

from app.models import (  # noqa: F401
    api_llamado_estado_diario,
    configuracion_correo,
    configuracion_google,
    configuracion_whatsapp,
    correo_log,
    estado_diario,
    estado_diario_agenda,
    estado_diario_origen,
    google_credencial,
    jurisdiccion,
    usuario,
)
