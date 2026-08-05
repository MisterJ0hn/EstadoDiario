"""Modelos de la base de un CLIENTE (tenant), declarados sobre `BaseTenant`.

Son las 12 tablas que se crean en `estado_diario_<guid>` al dar de alta un
cliente. Los modelos de la base principal están en `app.models.maestra`.

Importar cualquier submódulo (ej. `from app.models.usuario import Usuario`)
ejecuta este __init__ primero, lo que registra TODOS los modelos de tenant en
el registry de SQLAlchemy. Sin esto, un proceso que solo importa un modelo
puntual (como los jobs en app/jobs/, que corren fuera de FastAPI y nunca pasan
por app/main.py) falla al resolver relationship("Usuario", ...) u otras
relaciones expresadas como string, porque esas clases todavía no se cargaron.
"""

from app.models import (  # noqa: F401
    api_llamado_estado_diario,
    audiencia,
    correo_log,
    estado_diario,
    estado_diario_agenda,
    estado_diario_origen,
    google_credencial,
    jurisdiccion,
    log_actividades,
    movimiento,
    reporte_plantilla,
    usuario,
)
