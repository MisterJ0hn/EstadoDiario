"""Deja `causa` y `causa_corte` con UNA versión por abogado, la última.

Hasta ahora cada carga del Excel de Causas insertaba la cartera completa otra vez
y dejaba las filas de la carga anterior: lo que ya está en la base trae una copia
por cada archivo cargado de cada RUT. Desde el cambio del importador esto no se
repite (ver `CausaImportService`); este servicio limpia lo que quedó atrás.

Por RUT, con su archivo de Causas más reciente como referencia:

- la fila de un archivo viejo cuya llave ya está en el más reciente es una copia
  vieja: **se borra**;
- la que NO está en el más reciente salió del reporte en algún momento: **se
  conserva, pasa al archivo más reciente y queda retirada** (las dadas de alta por
  API no se retiran: no vienen en ningún Excel);
- si una misma llave aparece en varios archivos viejos, solo se conserva la del
  más nuevo.

Los archivos viejos siguen registrados (RUT, fecha, nombre, `url`), sin filas.
Es idempotente: corrida otra vez no encuentra nada que hacer.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.causa import ORIGEN_DATO_API, Causa
from app.models.causa_corte import CausaCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.usuario_rut import limpiar_rut
from app.services.causa_import_service import CausaImportService

logger = logging.getLogger(__name__)


def _clave_materia(c: Causa):
    return CausaImportService._clave_materia({"rol": c.rol, "tribunal": c.tribunal})


def _clave_corte(c: CausaCorte):
    return CausaImportService._clave_corte(
        {"tipo": c.tipo, "rol": c.rol, "era": c.era, "corte": c.corte}
    )


def depurar_versiones_anteriores(db: Session) -> dict:
    """Aplica la limpieza sobre la sesión (sin commit) y dice qué hizo."""
    ahora = datetime.now(timezone.utc)
    resumen = {"ruts": 0, "borradas": 0, "retiradas": 0, "movidas": 0}

    origenes = (
        db.query(EstadoDiarioOrigen)
        .filter(
            EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_CAUSAS,
            EstadoDiarioOrigen.deducida.is_(False),
        )
        .order_by(EstadoDiarioOrigen.fecha.desc(), EstadoDiarioOrigen.id.desc())
        .all()
    )
    por_rut: dict[str, list[EstadoDiarioOrigen]] = {}
    for o in origenes:
        por_rut.setdefault(limpiar_rut(o.rut or "") or f"origen-{o.id}", []).append(o)

    for grupo in por_rut.values():
        if len(grupo) < 2:
            continue
        resumen["ruts"] += 1
        vigente, viejos = grupo[0], grupo[1:]  # `grupo` viene del más nuevo al más viejo

        for modelo, clave_de in ((Causa, _clave_materia), (CausaCorte, _clave_corte)):
            claves_vigentes = {
                clave_de(f)
                for f in db.query(modelo).filter(modelo.estado_diario_origen_id == vigente.id)
            }
            claves_vigentes.discard(None)
            vistas = set()
            for viejo in viejos:  # del más nuevo al más viejo
                for fila in db.query(modelo).filter(modelo.estado_diario_origen_id == viejo.id).all():
                    clave = clave_de(fila)
                    es_api = getattr(fila, "origen_dato", None) == ORIGEN_DATO_API
                    if not es_api and clave is not None and (clave in claves_vigentes or clave in vistas):
                        db.delete(fila)
                        resumen["borradas"] += 1
                        continue
                    if clave is not None:
                        vistas.add(clave)
                    fila.estado_diario_origen_id = vigente.id
                    resumen["movidas"] += 1
                    if not es_api and fila.retirada_en is None:
                        fila.retirada_en = ahora
                        resumen["retiradas"] += 1
        db.flush()

    return resumen
