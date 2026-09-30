"""Contrato de las API keys de sistemas externos vistas desde la consola."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.api_key import normalizar_ips

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
    ips_permitidas: list[str] | None = Field(
        default=None,
        description=(
            "IP o rangos (CIDR) desde los que puede usarse. Nulo o vacío = desde cualquier IP."
        ),
    )

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

    @field_validator("ips_permitidas")
    @classmethod
    def _ips_validas(cls, valor):
        return None if valor is None else (_validar_ips(valor) or None)


def _validar_ips(valor: list[str]) -> list[str]:
    try:
        return normalizar_ips(valor)
    except ValueError as e:
        raise ValueError(str(e))


class ApiKeyUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    limite_por_minuto: int | None = Field(default=None, ge=1, le=10000)
    # Nulo = no cambiar. Lista vacía = quitar la restricción (cualquier IP).
    ips_permitidas: list[str] | None = None

    @field_validator("ips_permitidas")
    @classmethod
    def _ips_validas(cls, valor):
        return None if valor is None else _validar_ips(valor)


class ApiKeyResponse(BaseModel):
    id: int
    cliente_id: int
    nombre: str
    prefijo: str
    usuario_id: int
    permite_escritura: bool
    prefijos_escritura: list[str]
    limite_por_minuto: int
    # Vacía = desde cualquier IP.
    ips_permitidas: list[str] = []
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
