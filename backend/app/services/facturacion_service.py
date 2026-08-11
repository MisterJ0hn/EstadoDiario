"""Generación de la facturación mensual: qué se le cobra a cada cliente.

**La regla.** Se factura por cantidad de causas de la cartera vigente, y el
precio de cada concepto sale de `TarifaService` —es decir, del contrato de cada
cliente, no de una constante del producto:

| Qué                                | Cómo se cuenta                          |
|------------------------------------|-----------------------------------------|
| Una fila por materia (Civil, Familia, Penal…) | causas **vigentes** de esa materia |
| Corte de Apelaciones               | todas las causas de esa corte           |
| Corte Suprema                      | todas las causas de esa corte           |

Las de materia se cuentan **solo si están vigentes** (ver
`app.core.estados_causa`); las de corte se cuentan todas. No es un descuido:
"Fallada" en una corte dice que se falló ese recurso, no que la causa salió de
la cartera del estudio, y el reporte deja de traerla cuando eso pasa.

**Se genera el día 1 y queda escrita.** La cartera es una foto que se reemplaza
con cada carga del Excel de Causas: la de marzo no se puede reconstruir en
junio, porque ese archivo ya no está en la base. Por eso el día 1 se cuenta una
vez, se aplican las tarifas del cliente y se escribe la factura con su detalle
(`Factura` + `FacturaDetalle`). Todo lo que se muestre después sale de ahí y no
de volver a contar: una factura emitida no puede cambiar de monto porque el
estudio cerró tres causas ni porque se le renegoció el precio.

El job del día 1 factura **el mes que terminó**: correr el 1 de agosto crea el
período `2026-07-01`.

**Qué se entiende por "las causas activas del período".** La cartera no tiene
fecha de alta ni de baja: `causa` solo sabe de qué archivo salió. Lo que se
factura es la cartera vigente **según el último Excel cargado al momento de
generar**. Es una aproximación al mes calendario, y es la única disponible con
los datos que entrega el Poder Judicial. Por eso la fecha de ese archivo viaja
en la factura (`fecha_archivo_causas`): un cliente que dejó de cargar el Excel
se está facturando con una cartera vieja, y eso tiene que verse.

Los datos están repartidos —uno por base de cliente— así que se consulta una
vez por cliente y se junta acá. Cada consulta agrega en SQL: con una cartera de
9.000 causas, traer las filas para contarlas en Python sería arrastrar la base
entera al backend.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import sesion_tenant
from app.core.estados_causa import sql_vigente
from app.models.maestra.cliente import Cliente
from app.models.maestra.factura import Factura, FacturaDetalle
from app.repositories.cliente_repository import ClienteRepository
from app.services import factura_pdf
from app.services.tarifa_service import TarifaService, TarifasDeCliente

logger = logging.getLogger(__name__)

# Cómo se llaman en la factura las dos cortes. El Excel las trae como
# `apelaciones` y `suprema`; lo que se imprime es esto.
NOMBRE_CORTE = {
    "apelaciones": "Corte de Apelaciones",
    "suprema": "Corte Suprema",
}

# Nombre de la fila cuando la hoja del Excel no trae materia. Es preferible a
# agruparlas en otra materia cualquiera: son causas que se cobran y el detalle
# tiene que sumar el total.
MATERIA_SIN_NOMBRE = "Sin materia"

# Cuál es el archivo de causas vigente. Va aparte del conteo porque hace falta
# saberlo incluso cuando no hay ni una causa: la diferencia entre "cargó el
# Excel y no tiene causas" y "nunca cargó nada" es la que decide si el cero se
# factura o se investiga.
_SQL_ULTIMO_ORIGEN = text(
    """
    SELECT id, fecha
      FROM estado_diario_origen
     WHERE tipo = 'causas'
     ORDER BY fecha DESC, id DESC
     LIMIT 1
    """
)

# Las cantidades, agregadas en la base y agrupadas por concepto. Una sola
# consulta devuelve tantas filas como materias tenga el estudio más las dos
# cortes; sin el GROUP BY habría que traer las 9.000 causas para contarlas acá.
#
# Se acota a UN origen: el reporte trae la cartera completa cada vez, así que
# sin eso se facturaría la misma causa tantas veces como se haya cargado el
# Excel — el error más caro posible en este módulo.
#
# Nada de `FILTER (...)`: producción corre PostgreSQL 9.2 y esa sintaxis llegó
# en 9.4.
_SQL_CONCEPTOS = text(
    f"""
    SELECT 'materia' AS tipo,
           COALESCE(NULLIF(BTRIM(materia), ''), '{MATERIA_SIN_NOMBRE}') AS concepto,
           COUNT(*) AS cantidad
      FROM causa
     WHERE estado_diario_origen_id = :origen_id
       AND {sql_vigente('estado_causa')}
     GROUP BY COALESCE(NULLIF(BTRIM(materia), ''), '{MATERIA_SIN_NOMBRE}')
    UNION ALL
    SELECT 'corte' AS tipo, tipo AS concepto, COUNT(*) AS cantidad
      FROM causa_corte
     WHERE estado_diario_origen_id = :origen_id
     GROUP BY tipo
    """
)


def periodo_de(momento: date) -> date:
    """El período que le toca facturar a esa fecha: el MES ANTERIOR.

    Correr el job el 1 de agosto factura julio. Es lo que significa "facturación
    el 1 de cada mes": el mes ya terminó y por eso se puede cobrar.
    """
    ultimo_del_anterior = momento.replace(day=1) - timedelta(days=1)
    return ultimo_del_anterior.replace(day=1)


def fin_de_mes(periodo: date) -> date:
    """El último día del mes del período. `2026-07-01` → `2026-07-31`."""
    primero = periodo.replace(day=1)
    siguiente = (
        date(primero.year + 1, 1, 1)
        if primero.month == 12
        else date(primero.year, primero.month + 1, 1)
    )
    return siguiente - timedelta(days=1)


class ConceptoContado:
    """Un concepto con su cantidad, antes de ponerle precio."""

    def __init__(self, tipo: str, concepto: str, cantidad: int):
        self.tipo = tipo
        self.concepto = concepto
        self.cantidad = cantidad


class ResumenCartera:
    """Lo que se contó en la base de un cliente, antes de ponerle precio."""

    def __init__(
        self,
        conceptos: Optional[List[ConceptoContado]] = None,
        origen_id: Optional[int] = None,
        fecha_archivo: Optional[date] = None,
        estado: str = Factura.ORIGEN_OK,
        detalle: Optional[str] = None,
    ):
        self.conceptos = conceptos or []
        self.origen_id = origen_id
        self.fecha_archivo = fecha_archivo
        self.estado = estado
        self.detalle = detalle

    @property
    def total_causas(self) -> int:
        return sum(c.cantidad for c in self.conceptos)


class LineaCalculada:
    """Una línea del detalle con su precio ya aplicado."""

    def __init__(self, tipo: str, concepto: str, cantidad: int, valor_unitario: Decimal):
        self.tipo = tipo
        self.concepto = concepto
        self.cantidad = cantidad
        self.valor_unitario = valor_unitario
        self.valor_total = valor_unitario * cantidad


class FacturacionService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.clientes = ClienteRepository(db_maestra)
        self.tarifas = TarifaService(db_maestra)

    # ── Conteo ────────────────────────────────────────────

    def contar_cartera(self, cliente: Cliente) -> ResumenCartera:
        """Cuenta la cartera vigente del cliente en SU base, por concepto.

        Nunca lanza: un cliente con la base caída no puede impedir que se
        facturen los demás. Devuelve el resumen vacío con `estado=error` y el
        motivo, que es lo que distingue "este mes no tuvo causas" de "este mes
        no pudimos preguntarle" — dos cosas que no se facturan igual.
        """
        if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
            return ResumenCartera(
                estado=Factura.ORIGEN_SIN_DATOS,
                detalle="La base de datos del cliente no está lista",
            )

        try:
            with sesion_tenant(cliente.guid) as db:
                origen = db.execute(_SQL_ULTIMO_ORIGEN).first()
                if origen is None:
                    return ResumenCartera(
                        estado=Factura.ORIGEN_SIN_DATOS,
                        detalle="El cliente no tiene ningún archivo de causas cargado",
                    )
                origen_id, fecha_archivo = origen
                filas = db.execute(_SQL_CONCEPTOS, {"origen_id": origen_id}).fetchall()
        except Exception as e:
            logger.warning(
                "No se pudo contar la cartera del cliente %s: %s", cliente.guid, e
            )
            return ResumenCartera(estado=Factura.ORIGEN_ERROR, detalle=str(e)[:500])

        conceptos = [
            ConceptoContado(
                tipo=tipo,
                # El nombre que se imprime. Para las cortes, el legible.
                concepto=NOMBRE_CORTE.get(concepto, concepto) if tipo == "corte" else concepto,
                cantidad=int(cantidad or 0),
            )
            for tipo, concepto, cantidad in filas
            if int(cantidad or 0) > 0
        ]
        return ResumenCartera(
            conceptos=conceptos, origen_id=origen_id, fecha_archivo=fecha_archivo
        )

    # ── Cálculo ───────────────────────────────────────────

    @staticmethod
    def calcular(resumen: ResumenCartera, tarifas: TarifasDeCliente) -> List[LineaCalculada]:
        """Le pone precio a lo contado. Sin tocar la base: se usa igual para la
        factura definitiva y para la estimación del mes en curso.

        El orden es el de impresión: las materias alfabéticas y las cortes al
        final, que es como se lee el detalle.
        """
        materias = sorted(
            (c for c in resumen.conceptos if c.tipo == FacturaDetalle.TIPO_MATERIA),
            key=lambda c: c.concepto.lower(),
        )
        cortes = sorted(
            (c for c in resumen.conceptos if c.tipo == FacturaDetalle.TIPO_CORTE),
            key=lambda c: c.concepto.lower(),
        )

        lineas = [
            LineaCalculada(
                tipo=c.tipo,
                concepto=c.concepto,
                cantidad=c.cantidad,
                valor_unitario=tarifas.de_materia(c.concepto),
            )
            for c in materias
        ]
        for c in cortes:
            valor = (
                tarifas.de_suprema()
                if c.concepto == NOMBRE_CORTE["suprema"]
                else tarifas.de_apelaciones()
            )
            lineas.append(
                LineaCalculada(
                    tipo=c.tipo,
                    concepto=c.concepto,
                    cantidad=c.cantidad,
                    valor_unitario=valor,
                )
            )
        return lineas

    def estimar(self, cliente: Cliente) -> tuple[ResumenCartera, List[LineaCalculada]]:
        """Cuenta y valoriza AHORA, sin escribir nada.

        Es la respuesta a "cuánto va a salir la factura", que es lo que se
        pregunta el 20 del mes. Los números pueden cambiar hasta que se genere,
        y quien llama tiene que decirlo.
        """
        resumen = self.contar_cartera(cliente)
        return resumen, self.calcular(resumen, self.tarifas.resolver(cliente.cliente_id))

    # ── Generación ────────────────────────────────────────

    def generar_periodo(
        self,
        periodo: date,
        rehacer: bool = False,
        generado_por: Optional[str] = None,
    ) -> "ResultadoGeneracion":
        """Genera la factura del período para **todos** los clientes.

        Idempotente: un cliente que ya tiene factura **viva** de ese período se
        salta, así que correr el job dos veces el día 1 no cobra dos veces. Una
        factura anulada no cuenta: anularla y volver a generar es la forma de
        corregir un período mal facturado sin pasar por `rehacer`.

        Con `rehacer` se regenera aunque la anterior esté viva —se la anula y se
        emite una nueva con su propio número—, y eso solo tiene sentido el mismo
        día: después, el archivo de causas del cliente ya es otro y el recuento
        no daría lo que se facturó.

        **Un cliente cuya base no se pudo consultar no se factura.** Se informa
        y se deja para reintentar. La alternativa —emitirle una factura en $0—
        consumiría un número del correlativo por un documento que nadie debería
        mandar, y un mes en cero por caída se ve idéntico a un mes sin causas.
        """
        # El período es SIEMPRE el primer día del mes: es lo que asume el índice
        # único, `fin_de_mes()` y el agrupado del listado. Normalizar acá deja
        # que quien llame mande cualquier día de julio y siempre facture julio.
        periodo = periodo.replace(day=1)
        clientes = self.clientes.find_all()
        # Solo las VIVAS bloquean. Una factura anulada no se cobra, así que no
        # puede impedir emitir la que la reemplaza: anular y volver a generar es
        # justamente cómo se corrige un período mal facturado.
        #
        # Este filtro tiene que decir lo mismo que el índice único de la base
        # (`uq_factura_cliente_periodo`, parcial sobre `anulada = false`). Cuando
        # discrepaban, la base aceptaba la factura nueva y el servicio se negaba
        # a crearla: "0 nuevas, 2 ya existían" con las dos anuladas.
        existentes = {
            f.cliente_id: f
            for f in self.db.query(Factura)
            .filter(Factura.periodo == periodo, Factura.anulada.is_(False))
            .all()
        }
        tarifas_por_cliente = self.tarifas.resolver_varios(
            [c.cliente_id for c in clientes]
        )

        resultado = ResultadoGeneracion(periodo=periodo)
        for cliente in clientes:
            ya = existentes.get(cliente.cliente_id)
            if ya is not None and not rehacer:
                resultado.omitidas.append(ya)
                continue

            resumen = self.contar_cartera(cliente)
            if resumen.estado == Factura.ORIGEN_ERROR:
                resultado.con_error.append((cliente, resumen.detalle or "Error desconocido"))
                logger.error(
                    "Cliente %s sin facturar en %s: %s",
                    cliente.guid, periodo, resumen.detalle,
                )
                continue

            lineas = self.calcular(resumen, tarifas_por_cliente[cliente.cliente_id])
            try:
                if ya is not None:
                    # Rehacer no reescribe la factura anterior: la anula y emite
                    # otra. Un documento que ya salió y cambia de monto en
                    # silencio es exactamente lo que no puede pasar.
                    ya.marcar_anulada(
                        f"Regenerada el {date.today():%d-%m-%Y} por {generado_por or 'el sistema'}"
                    )
                    # El flush va acá y no se deja al commit: el índice único es
                    # parcial sobre las no anuladas, así que el UPDATE tiene que
                    # llegar a la base ANTES del INSERT de la factura nueva. Sin
                    # esto el orden lo decide SQLAlchemy y una regeneración
                    # puede reventar por conflicto consigo misma.
                    self.db.flush()
                factura = self._crear(cliente, periodo, resumen, lineas, generado_por)
                resultado.generadas.append(factura)
            except Exception as e:
                # Un cliente que falla al escribir no puede tumbar el resto del
                # período. La transacción es por cliente justamente por esto.
                self.db.rollback()
                logger.exception("No se pudo generar la factura de %s: %s", cliente.guid, e)
                resultado.con_error.append((cliente, str(e)[:500]))

        logger.info(
            "Facturación %s: %d generadas, %d ya existían, %d con error, total $%s",
            periodo,
            len(resultado.generadas),
            len(resultado.omitidas),
            len(resultado.con_error),
            resultado.total_generado,
        )
        return resultado

    def generar_para_cliente(
        self,
        cliente: Cliente,
        periodo: date,
        generado_por: Optional[str] = None,
    ) -> Factura:
        """La factura de un solo cliente. Devuelve la existente si ya está.

        Es lo que se llama al reintentar el cliente que falló, sin volver a
        recorrer los otros cincuenta.
        """
        periodo = periodo.replace(day=1)
        # Igual que en `generar_periodo`: una anulada no bloquea, porque no se
        # cobra y porque el índice único de la base tampoco la cuenta.
        ya = (
            self.db.query(Factura)
            .filter(
                Factura.cliente_id == cliente.cliente_id,
                Factura.periodo == periodo,
                Factura.anulada.is_(False),
            )
            .first()
        )
        if ya is not None:
            return ya

        resumen = self.contar_cartera(cliente)
        lineas = self.calcular(resumen, self.tarifas.resolver(cliente.cliente_id))
        return self._crear(cliente, periodo, resumen, lineas, generado_por)

    def _crear(
        self,
        cliente: Cliente,
        periodo: date,
        resumen: ResumenCartera,
        lineas: List[LineaCalculada],
        generado_por: Optional[str],
    ) -> Factura:
        """Escribe la factura y su detalle en **una** transacción.

        El PDF se dibuja antes del commit: si reventara, no queda una factura
        con un número consumido y sin documento que entregar.
        """
        factura = Factura(
            numero=self._siguiente_numero(),
            cliente_id=cliente.cliente_id,
            periodo=periodo,
            fecha_desde=periodo,
            fecha_hasta=fin_de_mes(periodo),
            fecha_emision=datetime.now(timezone.utc),
            estado=Factura.ESTADO_EMITIDA,
            emitida_por=generado_por,
            # Copia de los datos del cliente: la factura emitida no cambia si
            # después se corrige la dirección.
            razon_social=cliente.nombre,
            rut=cliente.rut,
            giro=cliente.giro,
            direccion=cliente.direccion,
            comuna=cliente.comuna,
            ciudad=cliente.ciudad,
            correo=cliente.correo,
            origen_estado=resumen.estado,
            origen_detalle=resumen.detalle,
            origen_causas_id=resumen.origen_id,
            fecha_archivo_causas=resumen.fecha_archivo,
        )

        total = Decimal("0")
        for i, linea in enumerate(lineas):
            total += linea.valor_total
            factura.detalles.append(
                FacturaDetalle(
                    tipo=linea.tipo,
                    concepto=linea.concepto,
                    cantidad=linea.cantidad,
                    valor_unitario=linea.valor_unitario,
                    valor_total=linea.valor_total,
                    orden=i,
                )
            )
        factura.total = total

        factura.pdf = factura_pdf.generar(datos_pdf(factura))
        factura.pdf_nombre = f"factura-{factura.numero_formateado}.pdf"

        self.db.add(factura)
        self.db.commit()
        self.db.refresh(factura)
        logger.info(
            "Factura %s generada al cliente %s por %s ($%s)",
            factura.numero_formateado, cliente.guid, periodo, total,
        )
        return factura

    def _siguiente_numero(self) -> int:
        """El siguiente correlativo global, sin huecos ni repetidos.

        Va con `LOCK TABLE ... IN EXCLUSIVE MODE` y no con una secuencia de
        PostgreSQL a propósito: una secuencia **deja huecos** cuando la
        transacción se deshace —los nextval no se revierten— y un talonario con
        el número 47 faltante es algo que después nadie puede explicar. El
        bloqueo serializa la emisión, que es exactamente lo que se quiere: se
        generan unas pocas al mes y son de las poquísimas operaciones donde
        esperar 20 ms vale más que la concurrencia.

        EXCLUSIVE deja pasar los SELECT (el listado sigue respondiendo) y
        bloquea solo a otro que esté generando al mismo tiempo. Se libera al
        cerrar la transacción, que es el commit de `_crear`.
        """
        self.db.execute(text("LOCK TABLE factura IN EXCLUSIVE MODE"))
        maximo = self.db.execute(text("SELECT COALESCE(MAX(numero), 0) FROM factura")).scalar()
        return int(maximo or 0) + 1

    # ── Consulta de períodos ──────────────────────────────

    def periodos(self) -> List[date]:
        """Períodos con facturas, del más nuevo al más viejo."""
        filas = (
            self.db.query(Factura.periodo)
            .filter(Factura.periodo.isnot(None))
            .distinct()
            .order_by(Factura.periodo.desc())
            .all()
        )
        return [f[0] for f in filas]


class ResultadoGeneracion:
    """Qué pasó al generar un período. Los tres grupos importan por separado:
    "todo bien" y "todo bien menos dos clientes que no respondieron" son
    respuestas distintas y la segunda exige que alguien haga algo."""

    def __init__(self, periodo: date):
        self.periodo = periodo
        self.generadas: List[Factura] = []
        self.omitidas: List[Factura] = []
        self.con_error: List[tuple[Cliente, str]] = []

    @property
    def total_generado(self) -> Decimal:
        return sum((Decimal(f.total or 0) for f in self.generadas), Decimal("0"))


def datos_pdf(factura: Factura) -> factura_pdf.DatosFactura:
    """Traduce el modelo al contrato de dibujo.

    Vive acá y no en `factura_pdf` para que ese módulo no dependa de la base y
    se pueda probar sin levantar Postgres.
    """
    return factura_pdf.DatosFactura(
        numero=factura.numero_formateado,
        fecha_emision=factura.fecha_emision,
        periodo=factura.periodo or factura.fecha_desde,
        razon_social=factura.razon_social,
        rut=factura.rut,
        giro=factura.giro,
        direccion=factura.direccion,
        comuna=factura.comuna,
        ciudad=factura.ciudad,
        correo=factura.correo,
        lineas=[
            factura_pdf.LineaFactura(
                concepto=d.concepto,
                cantidad=d.cantidad,
                valor_unitario=float(d.valor_unitario or 0),
                valor_total=float(d.valor_total or 0),
            )
            for d in factura.detalles
        ],
        total=float(factura.total or 0),
        emitida_por=factura.emitida_por,
    )
