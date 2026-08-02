from typing import Optional

from sqlalchemy.orm import Session

from app.models.reporte_plantilla import ReportePlantilla


class ReporteRepository:
    """Plantillas de informe. Cada usuario ve solo las suyas; `usuario_id=None`
    es el admin y ve todas, misma convención que el resto del sistema.
    """

    def __init__(self, db: Session):
        self.db = db

    def find_by_usuario(self, usuario_id: Optional[int]) -> list[ReportePlantilla]:
        query = self.db.query(ReportePlantilla)
        if usuario_id is not None:
            query = query.filter(ReportePlantilla.usuario_id == usuario_id)
        return query.order_by(ReportePlantilla.nombre).all()

    def find_by_id(self, plantilla_id: int, usuario_id: Optional[int]) -> Optional[ReportePlantilla]:
        query = self.db.query(ReportePlantilla).filter(ReportePlantilla.id == plantilla_id)
        if usuario_id is not None:
            query = query.filter(ReportePlantilla.usuario_id == usuario_id)
        return query.first()

    def save(self, plantilla: ReportePlantilla) -> ReportePlantilla:
        self.db.add(plantilla)
        self.db.commit()
        self.db.refresh(plantilla)
        return plantilla

    def delete(self, plantilla: ReportePlantilla) -> None:
        self.db.delete(plantilla)
        self.db.commit()
