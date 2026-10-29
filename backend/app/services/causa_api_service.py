"""Alta individual de una causa por un sistema externo (`POST /causas`).

**Regla central: la causa nace SIN abogado.** El RUT de una causa del Excel sale
del archivo del que vino; esta no vino de ninguno, así que no se le puede dar el
del archivo de la cartera (sería de otro abogado, o de ninguno si la cartera es
deducida) ni uno que mande el cliente. Queda con `rut_asignado` nulo hasta que un
estado diario de un abogado la traiga (ver
`CarteraSyncService._asignar_rut_desde_estado_diario`).

Vive dentro del archivo de la cartera vigente —el último de tipo `causas`—
porque Mis Causas y la facturación solo miran ese. Si el estudio no tiene
ninguno, se arma la cartera deducida, igual que hace el cruce.
"""

import logging
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.filtro_roles import norm_tribunal, norm_tribunal_sql
from app.models.causa import ORIGEN_DATO_API, Causa
from app.repositories.causa_repository import ultimo_origen_causas_id
from app.repositories.jurisdiccion_repository import JurisdiccionRepository
from app.services import auditoria_service as auditoria
from app.services.cartera_sync_service import CarteraSyncService

logger = logging.getLogger(__name__)

# Las materias que existen como hoja del reporte de Causas. Las de corte tienen
# otra tabla y otra llave, y no entran por acá.
MATERIAS = ("Civil", "Familia", "Laboral", "Cobranza", "Penal")

# Columnas que se conservan al pasar la causa a una cartera nueva.
CAMPOS_CAUSA_API = (
    "materia", "tipo_causa", "rol", "ruc", "tribunal", "fecha_ingreso",
    "caratulado", "estado_causa", "institucion", "jurisdiccion_id", "rut_asignado",
)


def _norm(valor: Optional[str]) -> str:
    return (valor or "").strip().lower()


def materia_canonica(valor: str) -> Optional[str]:
    """`civil` → `Civil`. None si no es una materia conocida."""
    buscada = _norm(valor)
    return next((m for m in MATERIAS if m.lower() == buscada), None)


def copiar_causa_de_api(db: Session, original: Causa, origen_id: int) -> Causa:
    """Pasa una causa de API a otro archivo de cartera sin perder su abogado."""
    nueva = Causa(
        estado_diario_origen_id=origen_id,
        origen_dato=ORIGEN_DATO_API,
        enriquecida_en=datetime.now(timezone.utc),
        **{campo: getattr(original, campo) for campo in CAMPOS_CAUSA_API},
    )
    db.add(nueva)
    return nueva


class CausaApiService:
    def __init__(self, db: Session):
        self.db = db

    def buscar_en_cartera(self, rol: str, tribunal: str) -> Optional[Causa]:
        """La causa de la cartera vigente con ese `rol + tribunal`, si existe."""
        origen_id = ultimo_origen_causas_id(self.db)
        if origen_id is None:
            return None
        return (
            self.db.query(Causa)
            .filter(
                Causa.estado_diario_origen_id == origen_id,
                func.lower(func.trim(Causa.rol)) == _norm(rol),
                norm_tribunal_sql(Causa.tribunal) == norm_tribunal(tribunal),
            )
            .order_by(Causa.id)
            .first()
        )

    def crear(
        self,
        *,
        materia: str,
        rol: str,
        tribunal: str,
        tipo_causa: Optional[str] = None,
        ruc: Optional[str] = None,
        fecha_ingreso: Optional[date] = None,
        caratulado: Optional[str] = None,
        estado_causa: Optional[str] = None,
        institucion: Optional[str] = None,
        usuario_id: Optional[int] = None,
    ) -> tuple[Causa, bool]:
        """`(causa, creada)`. Si ya está en Mis Causas la devuelve **tal cual**.

        No se actualiza una causa existente: tiene dueño y datos de un reporte
        del PJUD, y una llamada de API no tiene por qué pisarlos ni cambiar a
        quién pertenece.
        """
        existente = self.buscar_en_cartera(rol, tribunal)
        if existente is not None:
            return existente, False

        origen_id = ultimo_origen_causas_id(self.db)
        if origen_id is None:
            origen_id = CarteraSyncService(self.db)._crear_cartera_deducida().id

        jur = JurisdiccionRepository(self.db).find_by_nombre(materia)
        causa = Causa(
            estado_diario_origen_id=origen_id,
            origen_dato=ORIGEN_DATO_API,
            enriquecida_en=datetime.now(timezone.utc),
            materia=materia,
            tipo_causa=tipo_causa,
            rol=rol,
            ruc=ruc,
            tribunal=tribunal,
            fecha_ingreso=fecha_ingreso,
            caratulado=caratulado,
            estado_causa=estado_causa,
            institucion=institucion,
            jurisdiccion_id=jur.id if jur else None,
            rut_asignado=None,  # explícito: nace sin abogado
        )
        self.db.add(causa)
        self.db.flush()
        auditoria.registrar(
            self.db, auditoria.MODULO_CAUSAS, auditoria.ACCION_CREAR,
            usuario_id=usuario_id,
            detalle=f"Alta por API: {materia} {rol} · {tribunal} (sin abogado asignado)",
        )
        self.db.commit()
        logger.info("Causa %d dada de alta por API (%s %s)", causa.id, materia, rol)
        return causa, True
