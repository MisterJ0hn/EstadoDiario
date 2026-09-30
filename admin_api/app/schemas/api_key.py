"""Contrato de las API keys de sistemas externos vistas desde la consola."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

PREFIJO_API = "/api/v1/"


class ApiKeyCreate(BaseModel):
    nombre: str = Field(
        min_length=1,
        max_length=100,
        description="Qué sistema la usa. Es lo que se ve en la bitácora del cliente.",
    )
    # Sin escritura por defecto: la key más segura es la que no puede cambiar nada.
    permite_escritura: bool = False
    prefijos_escritura: list[str] | None = Field(
        default=None,
        description=(
            "Rutas donde puede escribir. Nulo = solo causas (/api/v1/causas). "
            "Solo tiene efecto si permite_escritura es true."
        ),
    )
    limite_por_minuto: int | None = Field(
        default=None, ge=1, le=10000, description="Nulo = el valor por defecto del sistema."
    )
    expira_en: datetime | None = None

    @field_validator("prefijos_escritura")
    @classmethod
    def _rutas_de_la_api(cls, valor):
        if valor is None:
            return None
        limpios = [v.strip().rstrip("/") for v in valor if v and v.strip()]
        for ruta in limpios:
            if not ruta.startswith(PREFIJO_API) or ".." in ruta or "//" in ruta:
                raise ValueError(
                    f"'{ruta}' no es una ruta de la API (debe empezar con {PREFIJO_API})"
                )
        return limpios or None


class ApiKeyUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    limite_por_minuto: int | None = Field(default=None, ge=1, le=10000)


class ApiKeyResponse(BaseModel):
    id: int
    cliente_id: int
    nombre: str
    prefijo: str
    usuario_id: int
    permite_escritura: bool
    prefijos_escritura: list[str]
    limite_por_minuto: int
    activa: bool
    fecha_creacion: datetime
    expira_en: datetime | None = None
    revocada_en: datetime | None = None
    ultimo_uso: datetime | None = None
    ultimo_ip: str | None = None


class ApiKeyCreadaResponse(ApiKeyResponse):
    """La única respuesta que trae la key en claro. No se puede recuperar
    después: si se pierde, se revoca y se emite otra."""

    key: str


class ApiKeyListResponse(BaseModel):
    total: int
    api_keys: list[ApiKeyResponse]
