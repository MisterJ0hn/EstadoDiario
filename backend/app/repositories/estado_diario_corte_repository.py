"""Consultas de las causas de corte.

Sin filtro de visibilidad: dentro de un estudio todos ven todo. Hubo un
permiso por jurisdiccion (usuario_jurisdiccion) y se elimino.
"""

import math
import re
from typing import Optional

from sqlalchemy import false, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.filtro_roles import (
    RolCorteFiltro, RolFiltro, condicion_roles, condicion_roles_numero_ingreso,
)
from app.models.causa_corte import CausaCorte
from app.models.estado_diario_corte import EstadoDiarioCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen


class EstadoDiarioCorteRepository:
    def __init__(self, db: Session):
        self.db = db

    @classmethod
    def _aplicar_filtros(
        cls,
        query,
        tipo: Optional[str],
        busqueda: Optional[str],
        corte: Optional[str],
        fecha_desde: Optional[str],
        fecha_hasta: Optional[str],
        por_roles=None,
    ):
        query = query

        if tipo:
            query = query.filter(EstadoDiarioCorte.tipo == tipo)
        if corte:
            # Parcial: el nombre viene con variantes ("C.A. de Santiago").
            query = query.filter(EstadoDiarioCorte.corte.ilike(f"%{corte}%"))
        if busqueda:
            patron = f"%{busqueda}%"
            query = query.filter(
                or_(
                    EstadoDiarioCorte.caratulado.ilike(patron),
                    EstadoDiarioCorte.numero_ingreso.ilike(patron),
                )
            )
        # El rango va sobre la fecha del ARCHIVO, igual que en el resto: el
        # usuario piensa en "el estado diario de esta semana", no en cuándo
        # ingresó la causa a la corte.
        if fecha_desde:
            query = query.filter(EstadoDiarioOrigen.fecha >= fecha_desde)
        if fecha_hasta:
            query = query.filter(EstadoDiarioOrigen.fecha <= fecha_hasta)
        if por_roles is not None:
            query = query.filter(por_roles)

        return query

    def _condicion_roles(
        self,
        roles: Optional[list[RolCorteFiltro]],
        roles_origen: Optional[list[RolFiltro]],
    ):
        """`roles` (la causa de corte) o `roles_origen` (su causa de primera
        instancia): sale la fila que calce con cualquiera de los dos. None = sin
        filtro.

        Esta tabla no guarda la causa origen: está en `causa_corte` (se anota al
        consultar el detalle PJUD). Se busca ahí a qué (rol, era, corte) le
        corresponde y se comparan esas claves con el número de ingreso."""
        condiciones = []
        if roles:
            condiciones.append(condicion_roles_numero_ingreso(EstadoDiarioCorte, roles))
        if roles_origen:
            origen = condicion_roles(CausaCorte.origen_rol, CausaCorte.origen_tribunal, roles_origen)
            claves: set[RolCorteFiltro] = set()
            for rol, era, corte in (
                self.db.query(CausaCorte.rol, CausaCorte.era, CausaCorte.corte).filter(origen).distinct()
            ):
                numero, anio = re.search(r"\d+", rol or ""), re.search(r"\d{4}", era or "")
                if numero and anio:
                    claves.add((None, str(int(numero.group())), anio.group(), (corte or "").strip() or None))
            # Sin ninguna apelación con ese origen no calza nada (no "sin filtro").
            condiciones.append(
                condicion_roles_numero_ingreso(EstadoDiarioCorte, list(claves)) if claves else false()
            )
        return or_(*condiciones) if condiciones else None

    def find_filtered(
        self,
        tipo: Optional[str] = None,
        busqueda: Optional[str] = None,
        corte: Optional[str] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        roles: Optional[list[RolCorteFiltro]] = None,
        roles_origen: Optional[list[RolFiltro]] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        por_roles = self._condicion_roles(roles, roles_origen)
        base = self.db.query(EstadoDiarioCorte).join(
            EstadoDiarioOrigen,
            EstadoDiarioCorte.estado_diario_origen_id == EstadoDiarioOrigen.id,
        )
        base = self._aplicar_filtros(
            base, tipo, busqueda, corte, fecha_desde, fecha_hasta, por_roles
        )

        conteo = self.db.query(func.count(EstadoDiarioCorte.id)).join(
            EstadoDiarioOrigen,
            EstadoDiarioCorte.estado_diario_origen_id == EstadoDiarioOrigen.id,
        )
        total = self._aplicar_filtros(
            conteo, tipo, busqueda, corte, fecha_desde, fecha_hasta, por_roles
        ).scalar() or 0

        query = base.options(joinedload(EstadoDiarioCorte.estado_diario_origen))
        # Lo más reciente primero: la pregunta de esta pantalla es qué se movió
        # últimamente en las cortes.
        query = query.order_by(
            EstadoDiarioCorte.fecha_ubicacion.desc().nullslast(),
            EstadoDiarioCorte.fecha_ingreso.desc().nullslast(),
            EstadoDiarioCorte.id.desc(),
        )

        total_pages = 1
        pagina_actual = 1
        if limit and limit > 0:
            total_pages = max(1, math.ceil(total / limit))
            pagina_actual = max(1, min(page or 1, total_pages))
            query = query.offset((pagina_actual - 1) * limit).limit(limit)

        return query.all(), total, pagina_actual, total_pages

    def contar_por_tipo_filtrado(
        self,
        busqueda: Optional[str] = None,
        corte: Optional[str] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        roles: Optional[list[RolCorteFiltro]] = None,
        roles_origen: Optional[list[RolFiltro]] = None,
    ) -> dict[str, int]:
        """{tipo: cuántas} bajo los mismos filtros que el listado, salvo `tipo`.

        Alimenta los contadores de las pestañas: cada una cuenta lo que
        mostraría al seleccionarla, no el total de la tabla.
        """
        query = self._aplicar_filtros(
            self.db.query(EstadoDiarioCorte.tipo, func.count(EstadoDiarioCorte.id)).join(
                EstadoDiarioOrigen,
                EstadoDiarioCorte.estado_diario_origen_id == EstadoDiarioOrigen.id,
            ),
            None, busqueda, corte, fecha_desde, fecha_hasta,
            self._condicion_roles(roles, roles_origen),
        )
        return {
            tipo: int(total or 0)
            for tipo, total in query.group_by(EstadoDiarioCorte.tipo).all()
        }

    def listar_cortes(self) -> list[str]:
        """Nombres de corte presentes, para el combo del filtro."""
        query = self.db.query(EstadoDiarioCorte.corte).filter(
            EstadoDiarioCorte.corte.isnot(None)
        )
        query = query
        return sorted({fila[0] for fila in query.distinct().all() if fila[0]})
