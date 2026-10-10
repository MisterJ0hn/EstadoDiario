"""Contrato de las API keys de sistemas externos vistas desde la consola."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.api_key import normalizar_ips
from app.core.sello_rsa import cargar_llave_publica

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

    expone_credenciales_pjud: bool = Field(
        default=False,
        description=(
            "Permite a la key pedir, con ?incluir_credenciales=true, el RUT, la clave y "
            "el método de login del OJV de los abogados dueños de las causas. Exige "
            "ips_permitidas y llave_publica_pem."
        ),
    )
    llave_publica_pem: str | None = Field(
        default=None,
        description=(
            "Llave pública RSA (PEM, mínimo 2048 bits) del sistema externo. Con ella se "
            "sella cada clave entregada: sin su llave privada no se puede leer."
        ),
    )

    @field_validator("llave_publica_pem")
    @classmethod
    def _llave_valida(cls, valor):
        return _validar_llave(valor)

    @model_validator(mode="after")
    def _credenciales_exigen_proteccion(self):
        if self.expone_credenciales_pjud:
            _exigir_proteccion(self.ips_permitidas, self.llave_publica_pem)
        return self

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


def _validar_llave(valor: str | None) -> str | None:
    if valor is None or not valor.strip():
        return None
    try:
        cargar_llave_publica(valor)
    except ValueError as e:
        raise ValueError(str(e))
    return valor.strip()


def _exigir_proteccion(ips: list[str] | None, llave: str | None) -> None:
    """Entregar credenciales sin estas dos capas es peor que no entregarlas."""
    if not ips:
        raise ValueError(
            "Para entregar credenciales del PJUD la key debe tener ips_permitidas"
        )
    if not llave:
        raise ValueError(
            "Para entregar credenciales del PJUD la key debe tener llave_publica_pem"
        )


class ApiKeyUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    limite_por_minuto: int | None = Field(default=None, ge=1, le=10000)
    # Nulo = no cambiar. Lista vacía = quitar la restricción (cualquier IP).
    ips_permitidas: list[str] | None = None
    # Nulo = no cambiar. Se valida contra el estado resultante en el servicio.
    expone_credenciales_pjud: bool | None = None
    llave_publica_pem: str | None = None

    @field_validator("ips_permitidas")
    @classmethod
    def _ips_validas(cls, valor):
        return None if valor is None else _validar_ips(valor)

    @field_validator("llave_publica_pem")
    @classmethod
    def _llave_valida(cls, valor):
        return _validar_llave(valor)


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
    expone_credenciales_pjud: bool = False
    # Huella SHA-256 de la llave pública cargada; la llave misma no se devuelve.
    llave_publica_huella: str | None = None
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
