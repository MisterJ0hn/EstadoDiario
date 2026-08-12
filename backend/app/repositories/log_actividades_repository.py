from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.log_actividades import LogActividades


class LogActividadesRepository:
    """Bitácora de actividad, en la base del cliente."""

    def __init__(self, db: Session):
        self.db = db

    def registrar(
        self,
        modulo: str,
        accion: str,
        usuario_id: Optional[int],
        ip: Optional[str] = None,
        detalle: Optional[str] = None,
    ) -> LogActividades:
        registro = LogActividades(
            modulo=modulo,
            accion=accion,
            usuario_id=usuario_id,
            ip=ip,
            detalle=detalle,
        )
        self.db.add(registro)
        self.db.commit()
        return registro

    def listar(
        self,
        usuario_id: Optional[int],
        page: int = 1,
        per_page: int = 50,
        modulo: Optional[str] = None,
        accion: Optional[str] = None,
        desde: Optional[date] = None,
        hasta: Optional[date] = None,
        busqueda: Optional[str] = None,
    ) -> tuple[list[LogActividades], int, int]:
        """Página de la bitácora.

        `usuario_id` es obligatorio y sin default a propósito: cada usuario ve
        solo su actividad. `None` significa "sin filtro" y queda reservado para
        el administrador del cliente, que sí ve la de todo el estudio.
        """
        query = self.db.query(LogActividades)
        if usuario_id is not None:
            query = query.filter(LogActividades.usuario_id == usuario_id)
        if modulo:
            query = query.filter(LogActividades.modulo == modulo)
        if accion:
            query = query.filter(LogActividades.accion == accion)
        if desde:
            query = query.filter(LogActividades.fecha_hora >= desde)
        if hasta:
            # El rango es inclusivo: quien escribe "hasta el 12" espera que
            # entre lo del día 12, no que se corte a medianoche del 11.
            query = query.filter(
                LogActividades.fecha_hora < datetime.combine(hasta, time.max)
            )
        if busqueda:
            query = query.filter(LogActividades.detalle.ilike(f"%{busqueda.strip()}%"))

        # count() sobre la consulta, no len() de las filas: contar en Python
        # obligaría a traerlas todas.
        total = query.count()
        items = (
            query.order_by(LogActividades.fecha_hora.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        total_pages = (total + per_page - 1) // per_page
        return items, total, total_pages

    def valores_de_filtro(self) -> tuple[list[str], list[str]]:
        """Los módulos y acciones que EXISTEN en esta bitácora.

        Se leen de los datos y no de una lista fija: cada estudio usa los
        módulos que usa, y ofrecer opciones que nunca van a devolver nada hace
        parecer que el filtro está roto.
        """
        modulos = [
            m[0] for m in self.db.query(LogActividades.modulo).distinct()
            .order_by(LogActividades.modulo).all() if m[0]
        ]
        acciones = [
            a[0] for a in self.db.query(LogActividades.accion).distinct()
            .order_by(LogActividades.accion).all() if a[0]
        ]
        return modulos, acciones

    def contar(self) -> int:
        """Cuántos registros tiene la bitácora. Para dimensionar la purga."""
        return self.db.query(LogActividades).count()

    def contar_a_purgar(self, dias_retencion: int) -> int:
        """Cuántos borraría `purgar(dias_retencion)` si se corriera ahora.

        La consola lo muestra antes de guardar la política: acortar el plazo
        elimina registros de forma definitiva y el administrador tiene que ver
        cuántos son antes de confirmar.
        """
        if dias_retencion <= 0:
            return 0
        return (
            self.db.query(LogActividades)
            .filter(LogActividades.fecha_hora < self._corte(dias_retencion))
            .count()
        )

    def purgar(self, dias_retencion: int) -> int:
        """Borra lo más viejo que `dias_retencion` días. Devuelve cuántas filas.

        Es la política de permanencia que configura el administrador por
        cliente (`cliente.dias_retencion_log`). El DELETE va por `fecha_hora`,
        que tiene índice propio justamente para esto.
        """
        if dias_retencion <= 0:
            return 0
        borradas = (
            self.db.query(LogActividades)
            .filter(LogActividades.fecha_hora < self._corte(dias_retencion))
            .delete(synchronize_session=False)
        )
        self.db.commit()
        return borradas

    @staticmethod
    def _corte(dias_retencion: int) -> datetime:
        return datetime.now(timezone.utc) - timedelta(days=dias_retencion)
