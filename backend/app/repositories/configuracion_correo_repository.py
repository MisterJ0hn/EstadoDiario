from typing import Optional

from sqlalchemy.orm import Session

from app.models.configuracion_correo import ConfiguracionCorreo


class ConfiguracionCorreoRepository:
    """La configuración es global: siempre se opera sobre una única fila."""

    def __init__(self, db: Session):
        self.db = db

    def get(self) -> Optional[ConfiguracionCorreo]:
        return self.db.query(ConfiguracionCorreo).order_by(ConfiguracionCorreo.id).first()

    def get_or_create(self) -> ConfiguracionCorreo:
        config = self.get()
        if config is None:
            config = ConfiguracionCorreo()
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        return config

    def save(self, config: ConfiguracionCorreo) -> ConfiguracionCorreo:
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config
