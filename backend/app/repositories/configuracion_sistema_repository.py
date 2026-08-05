from sqlalchemy.orm import Session

from app.models.maestra.configuracion_sistema import ConfiguracionSistema


class ConfiguracionSistemaRepository:
    """Parámetros de plataforma: una sola fila en la base PRINCIPAL."""

    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self) -> ConfiguracionSistema:
        """Fila única. Se crea con los valores por defecto la primera vez para
        que la consola de administración siempre tenga algo que mostrar."""
        config = (
            self.db.query(ConfiguracionSistema)
            .order_by(ConfiguracionSistema.id)
            .first()
        )
        if config is None:
            config = ConfiguracionSistema()
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        return config

    def save(self, config: ConfiguracionSistema) -> ConfiguracionSistema:
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config
