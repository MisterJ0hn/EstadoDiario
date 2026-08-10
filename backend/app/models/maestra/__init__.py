"""Modelos de la base PRINCIPAL (`estado_diario`), declarados sobre
`BaseMaestra`. Acá viven los clientes, los administradores del sistema y las
configuraciones; ningún dato operativo de un cliente.

Importar cualquier submódulo ejecuta este __init__ y registra todos los
modelos maestros, para que las relaciones expresadas como string resuelvan
aunque el proceso solo haya importado uno (los jobs, por ejemplo).
"""

from app.models.maestra import (  # noqa: F401
    cliente,
    configuracion_correo,
    configuracion_google,
    configuracion_sistema,
    configuracion_smtp,
    configuracion_whatsapp,
    password_historial_admin,
    usuario_admin,
)
