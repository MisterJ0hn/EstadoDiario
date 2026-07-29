from sqlalchemy.orm import Session

from app.models.configuracion_whatsapp import ConfiguracionWhatsapp


class ConfiguracionWhatsappRepository:
    """La configuración es global: siempre se opera sobre una única fila."""

    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self) -> ConfiguracionWhatsapp:
        config = (
            self.db.query(ConfiguracionWhatsapp).order_by(ConfiguracionWhatsapp.id).first()
        )
        if config is None:
            config = ConfiguracionWhatsapp()
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        return config

    def save(self, config: ConfiguracionWhatsapp) -> ConfiguracionWhatsapp:
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config
