from datetime import datetime, time, timezone
from typing import Optional

from sqlalchemy import String, Boolean, Integer, DateTime, Time, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseMaestra


class ConfiguracionCorreo(BaseMaestra):
    """Casilla IMAP desde la que se importan los adjuntos, **una por cliente**.

    Vive en la base principal, no en la del cliente: el job de ingesta necesita
    recorrer las casillas de todos los clientes de una pasada, y para eso tiene
    que poder leerlas sin abrir una conexión por base.

    La casilla por defecto de un cliente es `<guid>@temposoft.cl` (ver
    `Cliente.inbox`). Todo lo que llegue ahí se importa en la base de ESE
    cliente: la casilla es lo que amarra un correo entrante a una base.
    """

    __tablename__ = "configuracion_correo"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Dueño de la casilla. NOT NULL + UNIQUE: una casilla por cliente, y una
    # casilla sin cliente no se sabría en qué base importar.
    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("cliente.cliente_id"), nullable=False, unique=True, index=True
    )

    # Usuario de la base del cliente a nombre de quien queda lo importado.
    # Sin ForeignKey a propósito: apunta a `usuario.id` de OTRA base de datos y
    # PostgreSQL no puede validar esa referencia. Nulo = el primer usuario
    # administrador del cliente.
    usuario_destino_id: Mapped[Optional[int]] = mapped_column(Integer)

    activo: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Conexión IMAP ──
    # Gmail funciona como IMAP estándar: imap.gmail.com / 993 / SSL,
    # usando una contraseña de aplicación (requiere 2FA en la cuenta).
    host: Mapped[str] = mapped_column(String(255), default="imap.gmail.com")
    puerto: Mapped[int] = mapped_column(Integer, default=993)
    usar_ssl: Mapped[bool] = mapped_column(Boolean, default=True)
    usuario: Mapped[Optional[str]] = mapped_column(String(255))
    password_cifrado: Mapped[Optional[str]] = mapped_column(Text)
    carpeta: Mapped[str] = mapped_column(String(255), default="INBOX")

    # ── Filtros de seguridad ──
    # Lista blanca de remitentes separada por coma. Obligatoria: el buzón es
    # una entrada no autenticada y cualquiera puede mandar un adjunto.
    remitentes_permitidos: Mapped[Optional[str]] = mapped_column(Text)
    # Filtro general opcional: si está, el asunto debe contenerlo para que el
    # mensaje se procese. Es anterior a los tres asuntos por tipo de abajo y
    # cumple otro rol: éste descarta, los otros clasifican.
    asunto_contiene: Mapped[Optional[str]] = mapped_column(String(255))
    max_tamano_mb: Mapped[int] = mapped_column(Integer, default=25)

    # ── Identificación del tipo de reporte por asunto ──
    # El PJUD cambia los nombres de archivo sin aviso, así que el nombre dejó
    # de ser confiable para saber qué trae un adjunto. Estos tres campos son la
    # fuente primaria: si el asunto del correo contiene el texto configurado,
    # el adjunto se importa con ese parser. El nombre del archivo queda solo
    # como respaldo cuando ninguno calza.
    asunto_estado_diario: Mapped[Optional[str]] = mapped_column(String(255))
    asunto_movimientos: Mapped[Optional[str]] = mapped_column(String(255))
    asunto_audiencias: Mapped[Optional[str]] = mapped_column(String(255))

    # RUT del abogado dueño de la casilla. Respaldo para cuando el nombre del
    # archivo no lo trae: los reportes son siempre de este RUT, porque es a
    # esta casilla a la que el PJUD se los manda.
    rut: Mapped[Optional[str]] = mapped_column(String(20))

    # ── Programación ──
    hora_ejecucion: Mapped[Optional[time]] = mapped_column(Time)
    marcar_como_leido: Mapped[bool] = mapped_column(Boolean, default=True)

    # ── Estado de la última corrida ──
    ultima_ejecucion: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ultimo_resultado: Mapped[Optional[str]] = mapped_column(Text)

    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Se llama `dueno` y no `cliente` para no chocar con nada, y sobre todo no
    # `usuario`: esa columna ya es el nombre de la cuenta IMAP.
    dueno = relationship("Cliente", foreign_keys=[cliente_id])

    @property
    def lista_remitentes(self) -> list[str]:
        if not self.remitentes_permitidos:
            return []
        return [r.strip().lower() for r in self.remitentes_permitidos.split(",") if r.strip()]

    @property
    def asuntos_por_tipo(self) -> dict[str, str]:
        """{tipo de archivo -> texto a buscar en el asunto}, sin los vacíos.

        Las claves son los TIPO_* de EstadoDiarioOrigen. Import local para no
        crear un ciclo: el modelo de origen no depende de éste, pero sí al revés
        si se importara arriba.
        """
        from app.models.estado_diario_origen import EstadoDiarioOrigen

        candidatos = {
            EstadoDiarioOrigen.TIPO_ESTADO_DIARIO: self.asunto_estado_diario,
            EstadoDiarioOrigen.TIPO_MOVIMIENTOS: self.asunto_movimientos,
            EstadoDiarioOrigen.TIPO_AUDIENCIAS: self.asunto_audiencias,
        }
        return {tipo: texto.strip() for tipo, texto in candidatos.items() if texto and texto.strip()}
