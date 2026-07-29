from sqlalchemy.orm import Session

from app.models.configuracion_google import ConfiguracionGoogle


class ConfiguracionGoogleRepository:
    """La configuración es global: siempre se opera sobre una única fila."""

    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self) -> ConfiguracionGoogle:
        config = (
            self.db.query(ConfiguracionGoogle).order_by(ConfiguracionGoogle.id).first()
        )
        if config is None:
            config = ConfiguracionGoogle()
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        return config

    def save(self, config: ConfiguracionGoogle) -> ConfiguracionGoogle:
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config
