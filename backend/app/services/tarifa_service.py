"""Qué precio se le aplica a cada concepto de un cliente.

**El precio es del contrato, no del producto.** Al estudio A la causa le sale $1
y al B $2, y eso no puede ser una constante que se cambie con un despliegue para
todos a la vez. Por eso hay una tabla (`TarifaCliente`) y este servicio, que es
lo único que sabe resolverla.

**Un cliente sin configurar factura igual.** Ausencia de fila no es precio cero:
es "cobre lo de la plataforma", que ahora es un valor configurable desde
Administración → Configuración y ya no una constante del código: subir el precio
de lista no puede exigir un despliegue. Las constantes que quedan
(`TARIFAS_POR_DEFECTO`) son solo la semilla de la primera fila de configuración.

Obligar a sembrar tres filas por cliente nuevo funcionaría hasta el día en que se agregue un cuarto
concepto y haya que rellenar a mano todos los clientes que existan — y hasta ese
día, un alta a la que se le olvidó la configuración se facturaría en $0 sin que
nadie lo note.

**La resolución de una materia va de lo específico a lo general**:

    materia:Familia   →   materia   →   plataforma

Así el cliente al que se le cobra distinto lo penal declara una sola fila, y
nadie más tiene que enumerar sus cinco materias.
"""

import logging
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException
from app.models.maestra.tarifa_cliente import (
    CONCEPTO_APELACIONES,
    CONCEPTO_MATERIA,
    CONCEPTO_SUPREMA,
    PREFIJO_MATERIA,
    TARIFAS_POR_DEFECTO,
    TarifaCliente,
)

logger = logging.getLogger(__name__)

# Los conceptos que se pueden configurar sin nombrar una materia. Cualquier otro
# valor tiene que venir con el prefijo `materia:`; se valida al guardar para que
# un `Materia` mal escrito no se acepte y después facture al precio por defecto
# sin que nadie entienda por qué.
CONCEPTOS_BASE = (CONCEPTO_MATERIA, CONCEPTO_APELACIONES, CONCEPTO_SUPREMA)


class TarifasDeCliente:
    """Las tarifas de un cliente ya resueltas, para usarlas en un bucle.

    Se arma una vez por cliente y se pregunta N veces —una por materia—, en vez
    de consultar la base por cada línea del detalle.

    Lleva dentro las tarifas de la plataforma además de las del cliente: la
    resolución es `materia:<nombre>` → `materia` → plataforma, y las tres tienen
    que estar a mano para responder sin volver a la base.
    """

    def __init__(self, configuradas: Dict[str, Decimal], plataforma: Dict[str, Decimal]):
        self._configuradas = configuradas
        self._plataforma = plataforma

    def de_materia(self, materia: Optional[str]) -> Decimal:
        """Precio por causa de esa materia. `materia:Familia` pisa a `materia`."""
        if materia:
            especifica = self._configuradas.get(f"{PREFIJO_MATERIA}{materia}".lower())
            if especifica is not None:
                return especifica
        return self._valor(CONCEPTO_MATERIA)

    def de_apelaciones(self) -> Decimal:
        return self._valor(CONCEPTO_APELACIONES)

    def de_suprema(self) -> Decimal:
        return self._valor(CONCEPTO_SUPREMA)

    def _valor(self, concepto: str) -> Decimal:
        valor = self._configuradas.get(concepto)
        if valor is not None:
            return valor
        # La de la plataforma, y si esa faltara, la semilla del código: el
        # cálculo no puede quedarse sin precio y facturar en cero.
        return self._plataforma.get(concepto, TARIFAS_POR_DEFECTO[concepto])


class TarifaService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        # Se lee una vez por instancia: el cierre mensual resuelve las tarifas
        # de cincuenta clientes seguidos y la configuración es una sola fila que
        # no cambia en medio del proceso.
        self._plataforma: Optional[Dict[str, Decimal]] = None

    # ── Lectura ───────────────────────────────────────────

    def por_defecto(self) -> Dict[str, Decimal]:
        """Las tarifas de la plataforma, desde la configuración del sistema.

        Es lo que se cobra a quien no tiene valores propios, y es también lo que
        la pantalla de tarifas muestra como referencia.
        """
        if self._plataforma is None:
            from app.repositories.configuracion_sistema_repository import (
                ConfiguracionSistemaRepository,
            )

            config = ConfiguracionSistemaRepository(self.db).get_or_create()
            self._plataforma = {
                CONCEPTO_MATERIA: Decimal(config.tarifa_materia or 0),
                CONCEPTO_APELACIONES: Decimal(config.tarifa_apelaciones or 0),
                CONCEPTO_SUPREMA: Decimal(config.tarifa_suprema or 0),
            }
        return dict(self._plataforma)

    def resolver(self, cliente_id: int) -> TarifasDeCliente:
        """Las tarifas vigentes del cliente, listas para facturar.

        Las inactivas no entran: desactivar una tarifa devuelve al cliente al
        precio de la plataforma, que es lo que uno espera al apagarla en vez de
        borrarla.
        """
        filas = (
            self.db.query(TarifaCliente)
            .filter(TarifaCliente.cliente_id == cliente_id, TarifaCliente.activo.is_(True))
            .all()
        )
        # En minúsculas: la materia viene del Excel y "Familia" y "familia" son
        # la misma. Cotejar tal cual haría que una tarifa específica dejara de
        # aplicarse el día que el Poder Judicial cambie una mayúscula.
        return TarifasDeCliente(
            {f.concepto.lower(): Decimal(f.valor_unitario) for f in filas},
            self.por_defecto(),
        )

    def resolver_varios(self, cliente_ids: List[int]) -> Dict[int, TarifasDeCliente]:
        """Lo mismo para muchos clientes, en una sola consulta.

        Lo usa el cierre del día 1: con cincuenta clientes, una consulta por
        cliente serían cincuenta viajes a la base para leer tres números cada
        vez.
        """
        if not cliente_ids:
            return {}

        por_cliente: Dict[int, Dict[str, Decimal]] = {cid: {} for cid in cliente_ids}
        filas = (
            self.db.query(TarifaCliente)
            .filter(
                TarifaCliente.cliente_id.in_(cliente_ids),
                TarifaCliente.activo.is_(True),
            )
            .all()
        )
        for f in filas:
            por_cliente[f.cliente_id][f.concepto.lower()] = Decimal(f.valor_unitario)
        # Todos los pedidos vienen en el resultado, incluso los que no tienen
        # ninguna fila: quien llama indexa por cliente_id sin comprobar, y un
        # KeyError acá dejaría a un cliente sin facturar por no tener tarifas
        # propias — que es justo el caso normal.
        plataforma = self.por_defecto()
        return {
            cid: TarifasDeCliente(conf, plataforma) for cid, conf in por_cliente.items()
        }

    def listar(self, cliente_id: int) -> List[TarifaCliente]:
        """Lo configurado para el cliente, tal cual está en la base.

        Devuelve **solo las filas propias**, sin rellenar con los valores por
        defecto: la pantalla necesita distinguir "este cliente tiene $2
        acordado" de "a este se le cobra lo de la plataforma", y una lista que
        siempre trae tres filas borra esa diferencia.
        """
        return (
            self.db.query(TarifaCliente)
            .filter(TarifaCliente.cliente_id == cliente_id)
            .order_by(TarifaCliente.concepto)
            .all()
        )

    # ── Escritura ─────────────────────────────────────────

    def guardar(
        self, cliente_id: int, concepto: str, valor_unitario: Decimal, activo: bool = True
    ) -> TarifaCliente:
        """Crea o actualiza la tarifa del concepto. Idempotente por
        (cliente, concepto), que es lo que garantiza el índice único."""
        concepto = self._validar_concepto(concepto)
        if valor_unitario < 0:
            raise BadRequestException("El valor unitario no puede ser negativo.")

        tarifa = (
            self.db.query(TarifaCliente)
            .filter(
                TarifaCliente.cliente_id == cliente_id,
                TarifaCliente.concepto == concepto,
            )
            .first()
        )
        if tarifa is None:
            tarifa = TarifaCliente(cliente_id=cliente_id, concepto=concepto)
            self.db.add(tarifa)

        tarifa.valor_unitario = valor_unitario
        tarifa.activo = activo
        self.db.commit()
        self.db.refresh(tarifa)
        logger.info(
            "Tarifa %s del cliente %s fijada en %s (activa: %s)",
            concepto, cliente_id, valor_unitario, activo,
        )
        return tarifa

    def eliminar(self, cliente_id: int, tarifa_id: int) -> None:
        """Borra la fila y devuelve al cliente al precio de la plataforma.

        Se filtra también por `cliente_id` y no solo por el id de la tarifa: sin
        eso, un id de otro cliente en la URL borraría la tarifa de ese otro.
        """
        tarifa = (
            self.db.query(TarifaCliente)
            .filter(TarifaCliente.id == tarifa_id, TarifaCliente.cliente_id == cliente_id)
            .first()
        )
        if tarifa is None:
            return
        self.db.delete(tarifa)
        self.db.commit()
        logger.info("Tarifa %s del cliente %s eliminada", tarifa.concepto, cliente_id)

    @staticmethod
    def _validar_concepto(concepto: str) -> str:
        """Normaliza y rechaza lo que no se sabría cobrar.

        Un concepto inventado no rompe nada al guardarlo y jamás se aplica: la
        factura saldría al precio por defecto y nadie sabría por qué. Es mejor
        que falle acá, donde hay alguien mirando el formulario.
        """
        limpio = (concepto or "").strip()
        if not limpio:
            raise BadRequestException("Indique el concepto de la tarifa.")

        if limpio.lower() in CONCEPTOS_BASE:
            return limpio.lower()

        if limpio.lower().startswith(PREFIJO_MATERIA):
            nombre = limpio[len(PREFIJO_MATERIA) :].strip()
            if not nombre:
                raise BadRequestException(
                    "Indique la materia después de 'materia:', por ejemplo 'materia:Familia'."
                )
            return f"{PREFIJO_MATERIA}{nombre}"

        raise BadRequestException(
            "Concepto no válido. Use 'materia', 'apelaciones', 'suprema' o "
            "'materia:<nombre>' para una materia en particular."
        )
