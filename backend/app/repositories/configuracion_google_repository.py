from typing import Optional

from sqlalchemy.orm import Session

from app.models.maestra.configuracion_google import ConfiguracionGoogle


class ConfiguracionGoogleRepository:
    """Credenciales OAuth de Google: una fila global del sistema y, opcionalmente, una por cliente.

    Vive en la base PRINCIPAL, así que la sesión que recibe es la maestra.
    `cliente_id` va sin valor por defecto a propósito: quien llama tiene que
    decir explícitamente si opera sobre la fila de un cliente o sobre la
    global del sistema (`None`), y no caer en una por descuido.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self, cliente_id: Optional[int]) -> ConfiguracionGoogle:
        query = self.db.query(ConfiguracionGoogle)
        if cliente_id is None:
            query = query.filter(ConfiguracionGoogle.cliente_id.is_(None))
        else:
            query = query.filter(ConfiguracionGoogle.cliente_id == cliente_id)

        config = query.order_by(ConfiguracionGoogle.id).first()
        if config is None:
            config = ConfiguracionGoogle(cliente_id=cliente_id)
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        return config

    def get_efectiva(self, cliente_id: int) -> ConfiguracionGoogle:
        """La del cliente si la tiene; si no, la global del sistema."""
        propia = (
            self.db.query(ConfiguracionGoogle)
            .filter(ConfiguracionGoogle.cliente_id == cliente_id)
            .first()
        )
        return propia if propia is not None else self.get_or_create(None)

    def save(self, config: ConfiguracionGoogle) -> ConfiguracionGoogle:
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config
