from sqlalchemy.orm import Session

from app.models.maestra.configuracion_transbank import ConfiguracionTransbank


class ConfiguracionTransbankRepository:
    """La única fila de configuración de Webpay, en la base PRINCIPAL.

    Sin `cliente_id` y sin `get_efectiva`, a diferencia de las de Twilio, SMTP
    y Google: la cuenta de Transbank donde cae la plata es la de la plataforma,
    no la del estudio. Ver el docstring del modelo.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self) -> ConfiguracionTransbank:
        """La configuración vigente; la crea apagada si todavía no existe.

        Se toma la de menor id y no `.one()` a propósito: si por cualquier
        razón hubiera dos filas, devolver siempre la misma es preferible a
        romper el arranque de la pantalla de configuración.
        """
        config = (
            self.db.query(ConfiguracionTransbank)
            .order_by(ConfiguracionTransbank.id)
            .first()
        )
        if config is None:
            config = ConfiguracionTransbank()
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        return config

    def save(self, config: ConfiguracionTransbank) -> ConfiguracionTransbank:
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config
