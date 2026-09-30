from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseMaestra


class ApiKey(BaseMaestra):
    """Credencial de un sistema externo para hablar con la API de UN cliente.

    Vive en la base principal y no en la del cliente por la misma razón que
    `cliente`: hay que resolver a qué base ir ANTES de poder abrirla, y la key
    es lo único que trae la request (ver `app/core/api_key.py`).

    **La key en claro no se guarda.** Solo su SHA-256 (`key_hash`): es un valor
    aleatorio de 256 bits, no una contraseña elegida por una persona, así que
    no necesita bcrypt ni sal. Si se pierde, se revoca y se emite otra; no hay
    forma de recuperarla. `prefijo` son los primeros caracteres y existe solo
    para que una persona reconozca cuál es cuál en una pantalla o en el log.

    Cada key tiene su propio usuario de integración dentro de la base del
    cliente (`usuario_id`, con `es_integracion`): es lo que hace que la
    bitácora y las columnas `usuario_id` de las tablas operativas digan QUÉ
    sistema hizo cada cosa, y no solo "una key".
    """

    __tablename__ = "api_key"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("cliente.cliente_id"), nullable=False, index=True
    )
    # Id del usuario de integración EN LA BASE DEL CLIENTE. Sin FK: es otra base.
    usuario_id: Mapped[int] = mapped_column(Integer, nullable=False)

    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    prefijo: Mapped[str] = mapped_column(String(16), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)

    # Sin esto la key solo lee. Escribir además exige que la ruta esté en
    # `prefijos_escritura` (o en el valor por defecto de `app/core/api_key.py`
    # si está nulo): tener permiso de escritura NO es tenerlo sobre todo.
    permite_escritura: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Rutas donde puede escribir, separadas por coma. Nulo = el valor por
    # defecto del código. Existe para, el día que se ofrezca a un tercero,
    # acotarlo por key sin tocar código.
    prefijos_escritura: Mapped[Optional[str]] = mapped_column(Text)

    limite_por_minuto: Mapped[int] = mapped_column(Integer, nullable=False)

    activa: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    # Quién la emitió (id de `usuario` de la base principal). Informativo.
    creada_por: Mapped[Optional[int]] = mapped_column(Integer)
    expira_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    revocada_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Se actualizan como máximo una vez por minuto (ver `registrar_uso`): una
    # escritura por request sería pagar un UPDATE en la base principal por cada
    # lectura del sistema externo.
    ultimo_uso: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ultimo_ip: Mapped[Optional[str]] = mapped_column(String(45))


class ApiKeyUso(BaseMaestra):
    """Contador del límite de velocidad: una fila por key y por minuto.

    En la base y no en memoria porque no se sabe cuántos workers corren: un
    contador por proceso daría un límite real de N veces el configurado, y N
    cambia con cada despliegue sin que nadie lo note. Las filas viejas se
    purgan solas (ver `_purgar`).
    """

    __tablename__ = "api_key_uso"

    api_key_id: Mapped[int] = mapped_column(
        ForeignKey("api_key.id", ondelete="CASCADE"), primary_key=True
    )
    # Inicio del minuto, en UTC.
    ventana: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    contador: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
