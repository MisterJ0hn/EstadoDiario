"""Log de consultas a api-pjud.codifica.cl, en la base principal.

El `registrar` corre siempre después de cada consulta de Detalle PJUD y NUNCA
debe hacerla fallar: si el log revienta (base caída, columna que falta en un
despliegue a medio hacer), el usuario igual tiene que ver su causa. Por eso el
endpoint envuelve la llamada a `registrar` en un try/except que solo loguea.
"""

from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.maestra.pjud_llamado import PjudLlamado


class PjudLlamadoRepository:
    def __init__(self, db: Session):
        self.db = db

    def registrar(
        self,
        *,
        cliente_id: Optional[int],
        guid: Optional[str],
        usuario_id: Optional[int],
        causa_id: Optional[int],
        rol: Optional[str],
        tribunal: Optional[str],
        forzar: bool,
        resultado: str,
        http_status: Optional[int],
        mensaje: Optional[str],
        diagnostico: Optional[str],
        duracion_ms: Optional[int],
    ) -> PjudLlamado:
        fila = PjudLlamado(
            cliente_id=cliente_id,
            guid=guid,
            usuario_id=usuario_id,
            causa_id=causa_id,
            rol=rol,
            tribunal=tribunal,
            forzar=forzar,
            resultado=resultado,
            http_status=http_status,
            mensaje=mensaje,
            diagnostico=diagnostico,
            duracion_ms=duracion_ms,
        )
        self.db.add(fila)
        self.db.commit()
        return fila

    def listar(
        self,
        *,
        page: int = 1,
        per_page: int = 50,
        cliente_id: Optional[int] = None,
        resultado: Optional[str] = None,
        desde: Optional[date] = None,
        hasta: Optional[date] = None,
        busqueda: Optional[str] = None,
    ) -> tuple[list[PjudLlamado], int, int]:
        q = self.db.query(PjudLlamado)

        if cliente_id is not None:
            q = q.filter(PjudLlamado.cliente_id == cliente_id)
        if resultado:
            q = q.filter(PjudLlamado.resultado == resultado)
        if desde:
            q = q.filter(PjudLlamado.fecha_hora >= datetime.combine(desde, time.min, timezone.utc))
        if hasta:
            # `hasta` inclusive: hasta el final de ese día.
            tope = datetime.combine(hasta + timedelta(days=1), time.min, timezone.utc)
            q = q.filter(PjudLlamado.fecha_hora < tope)
        if busqueda:
            patron = f"%{busqueda}%"
            q = q.filter(
                PjudLlamado.rol.ilike(patron)
                | PjudLlamado.tribunal.ilike(patron)
                | PjudLlamado.mensaje.ilike(patron)
                | PjudLlamado.diagnostico.ilike(patron)
            )

        total = q.count()
        total_pages = max(1, (total + per_page - 1) // per_page)
        items = (
            q.order_by(PjudLlamado.fecha_hora.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total, total_pages

    def ultimos_por_causa(
        self, *, cliente_id: Optional[int], causa_ids: list[int]
    ) -> dict[int, str]:
        """`{causa_id: resultado}` del llamado más reciente de cada causa, para
        pintar en el listado de causas el icono de estado del PJUD (nunca
        sincronizada / sincronizando / error / lista) sin tener que abrir el
        modal (que sí golpea al proveedor en vivo)."""
        if not causa_ids:
            return {}
        ultima_fecha = (
            self.db.query(
                PjudLlamado.causa_id,
                func.max(PjudLlamado.fecha_hora).label("ultima"),
            )
            .filter(
                PjudLlamado.cliente_id == cliente_id,
                PjudLlamado.causa_id.in_(causa_ids),
            )
            .group_by(PjudLlamado.causa_id)
            .subquery()
        )
        filas = (
            self.db.query(PjudLlamado.causa_id, PjudLlamado.resultado)
            .join(
                ultima_fecha,
                (PjudLlamado.causa_id == ultima_fecha.c.causa_id)
                & (PjudLlamado.fecha_hora == ultima_fecha.c.ultima),
            )
            .filter(PjudLlamado.cliente_id == cliente_id)
            .all()
        )
        # Si dos llamados de la misma causa cayeron en el mismo instante (no
        # debería, pero por las dudas), se queda con cualquiera de los dos: da
        # igual para lo que se usa (pintar un icono de estado).
        return {causa_id: resultado for causa_id, resultado in filas}

    def resumen(self, dias: int = 7) -> dict[str, int]:
        """Conteo por resultado en los últimos `dias`, para la cabecera de la
        pantalla ("32 consultas, 4 con error")."""
        desde = datetime.now(timezone.utc) - timedelta(days=dias)
        filas = (
            self.db.query(PjudLlamado.resultado, func.count())
            .filter(PjudLlamado.fecha_hora >= desde)
            .group_by(PjudLlamado.resultado)
            .all()
        )
        return {resultado: n for resultado, n in filas}
