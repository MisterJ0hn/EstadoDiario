from typing import Optional

from sqlalchemy.orm import Session

from app.models.maestra.configuracion_correo import ConfiguracionCorreo


class ConfiguracionCorreoRepository:
    """Una casilla IMAP por cliente, en la base PRINCIPAL.

    La sesión que recibe es la maestra: la configuración de correo no vive en
    la base del cliente, porque el job de ingesta tiene que poder recorrer las
    casillas de todos los clientes sin abrir una conexión por base.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_by_cliente(self, cliente_id: int) -> Optional[ConfiguracionCorreo]:
        return (
            self.db.query(ConfiguracionCorreo)
            .filter(ConfiguracionCorreo.cliente_id == cliente_id)
            .first()
        )

    def get_or_create(self, cliente_id: int) -> ConfiguracionCorreo:
        config = self.get_by_cliente(cliente_id)
        if config is None:
            config = ConfiguracionCorreo(cliente_id=cliente_id)
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        return config

    def find_activas(self) -> list[ConfiguracionCorreo]:
        """Casillas que el job debe revisar: activas y con credenciales."""
        return (
            self.db.query(ConfiguracionCorreo)
            .filter(
                ConfiguracionCorreo.activo.is_(True),
                ConfiguracionCorreo.usuario.isnot(None),
                ConfiguracionCorreo.password_cifrado.isnot(None),
            )
            .order_by(ConfiguracionCorreo.cliente_id)
            .all()
        )

    def save(self, config: ConfiguracionCorreo) -> ConfiguracionCorreo:
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config
