from typing import Optional

from sqlalchemy.orm import Session

from app.models.configuracion_correo import ConfiguracionCorreo


class ConfiguracionCorreoRepository:
    """Una casilla IMAP por usuario.

    Antes había una sola fila global. Esa fila sigue existiendo con
    `usuario_id` NULL y ya no la usa nadie: se conserva para no borrar
    credenciales configuradas a mano. Todas las operaciones de acá exigen un
    `usuario_id` concreto.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_by_usuario(self, usuario_id: int) -> Optional[ConfiguracionCorreo]:
        return (
            self.db.query(ConfiguracionCorreo)
            .filter(ConfiguracionCorreo.usuario_id == usuario_id)
            .first()
        )

    def get_or_create(self, usuario_id: int) -> ConfiguracionCorreo:
        config = self.get_by_usuario(usuario_id)
        if config is None:
            config = ConfiguracionCorreo(usuario_id=usuario_id)
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        return config

    def find_activas(self) -> list[ConfiguracionCorreo]:
        """Casillas que el job debe revisar: activas, con credenciales y con
        dueño. Sin dueño no se sabría a quién asignar lo descargado, así que la
        fila global heredada queda fuera por construcción.
        """
        return (
            self.db.query(ConfiguracionCorreo)
            .filter(
                ConfiguracionCorreo.activo.is_(True),
                ConfiguracionCorreo.usuario_id.isnot(None),
                ConfiguracionCorreo.usuario.isnot(None),
                ConfiguracionCorreo.password_cifrado.isnot(None),
            )
            .order_by(ConfiguracionCorreo.usuario_id)
            .all()
        )

    def save(self, config: ConfiguracionCorreo) -> ConfiguracionCorreo:
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config
