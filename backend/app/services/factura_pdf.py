"""Dibujo del PDF de una orden de compra.

Módulo **sin base de datos y sin sesión**: recibe datos ya resueltos y devuelve
bytes. Así el PDF se puede generar y mirar en una prueba sin levantar Postgres,
que es lo único que hace tolerable iterar sobre un diseño impreso.

**El diseño sigue el ejemplo `ejemplos/Orden de compra-209378.pdf`**: marca
arriba a la izquierda, cinta diagonal con el estado en la esquina, banda gris
con el número y las fechas, bloque "Facturado a", tabla de detalle con bordes y
filas de totales al pie de la tabla, y una línea centrada de generación abajo.

**Sobre "no modificable".** El PDF sale con la edición, la copia y la
extracción bloqueadas por los permisos del formato, y con una clave de
propietario que nadie conoce. Eso **disuade**, no impide: los permisos de PDF
los ignora cualquier herramienta libre, y así está diseñado el formato. La
garantía de verdad es la otra mitad: el archivo emitido queda guardado en la
base (`Factura.pdf`) y es esa copia la que vale. Un PDF que llegue alterado se
contrasta contra ella. Si algún día hace falta que la alteración sea detectable
sin tener la copia al lado, lo que corresponde es una firma digital con
certificado, no más permisos.

La clave de propietario se deriva de `BACKEND_SECRET_KEY` en vez de guardarse:
una clave en la base es una clave que alguien puede leer, y una constante en el
código es una clave publicada en el repositorio.
"""

import hashlib
import hmac
from datetime import date, datetime
from io import BytesIO
from typing import Optional, Sequence

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from app.core.config import settings

# Tamaño de página y márgenes. A4 y no Letter porque es el papel de Chile.
ANCHO, ALTO = A4
MARGEN = 20 * mm
ANCHO_UTIL = ANCHO - 2 * MARGEN

# Paleta mínima: gris para lo secundario, un azul para la marca. Una orden de
# compra no es un folleto; el color solo separa la información.
GRIS = colors.HexColor("#4b5563")
GRIS_LINEA = colors.HexColor("#c9ced6")
GRIS_FONDO = colors.HexColor("#eeeeee")
TINTA = colors.HexColor("#111827")
ACENTO = colors.HexColor("#1d4ed8")

# Colores de la cinta de estado, uno por estado. Rojo para lo que se debe,
# verde para lo pagado, gris para lo que ya no corre.
ROJO = colors.HexColor("#c0392b")
VERDE = colors.HexColor("#15803d")

# Nombre del emisor, tal como se imprime bajo la marca.
EMISOR = "Temposoft"
EMISOR_LEGAL = "Temposoft Ltda."

MESES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)

# Estados y la leyenda que le corresponde a cada uno en la cinta.
CINTA_POR_ESTADO = {
    "emitida": ("NO PAGADA", ROJO),
    "pagada": ("PAGADA", VERDE),
    "anulada": ("ANULADA", GRIS),
}


def clave_propietario() -> str:
    """Clave de propietario del PDF, derivada y estable.

    Estable a propósito: si cambiara en cada emisión, dos copias de la misma
    orden serían archivos distintos y no se podrían comparar. Va por HMAC con
    un namespace propio para que no coincida con ninguna otra clave derivada
    del mismo secreto.
    """
    return hmac.new(
        settings.BACKEND_SECRET_KEY.encode(), b"factura-pdf", hashlib.sha256
    ).hexdigest()[:32]


def pesos(monto: float) -> str:
    """`7570` → `$7.570`. Peso chileno: sin decimales y con punto de miles."""
    entero = int(round(monto or 0))
    return "$" + f"{entero:,}".replace(",", ".")


def mes_largo(periodo: date) -> str:
    """`2026-07-01` → `julio 2026`."""
    return f"{MESES[periodo.month - 1]} {periodo.year}"


class LineaFactura:
    """Una fila del detalle: un concepto, su cantidad y su valor.

    Es un contrato de dibujo, no el modelo ORM: este módulo no importa nada de
    la base para poder probarse solo.
    """

    def __init__(
        self,
        concepto: str,
        cantidad: int,
        valor_unitario: float,
        valor_total: float,
    ):
        self.concepto = concepto
        self.cantidad = cantidad
        self.valor_unitario = valor_unitario
        self.valor_total = valor_total


class DatosFactura:
    """Todo lo que se imprime, ya resuelto."""

    def __init__(
        self,
        numero: str,
        fecha_emision: datetime,
        periodo: date,
        razon_social: str,
        rut: str,
        giro: Optional[str],
        direccion: Optional[str],
        comuna: Optional[str],
        ciudad: Optional[str],
        correo: Optional[str],
        lineas: Sequence[LineaFactura],
        total: float,
        emitida_por: Optional[str] = None,
        estado: str = "emitida",
    ):
        self.numero = numero
        self.fecha_emision = fecha_emision
        # Primer día del mes facturado. Una orden cubre un mes entero, así que
        # se imprime "julio 2026" y no un rango de fechas: el rango invitaba a
        # creer que se podía facturar media mensualidad.
        self.periodo = periodo
        self.razon_social = razon_social
        self.rut = rut
        self.giro = giro
        self.direccion = direccion
        self.comuna = comuna
        self.ciudad = ciudad
        self.correo = correo
        self.lineas = lineas
        self.total = total
        self.emitida_por = emitida_por
        # Lo que dice la cinta de la esquina. Es el único dato del documento que
        # cambia después de emitido, y por eso el PDF se vuelve a dibujar cuando
        # la orden se paga o se anula (ver `FacturaService`).
        self.estado = estado

    @property
    def ubicacion(self) -> Optional[str]:
        """`Providencia, Santiago`, omitiendo lo que falte."""
        partes = [p for p in (self.comuna, self.ciudad) if p]
        return ", ".join(partes) if partes else None

    @property
    def total_causas(self) -> int:
        return sum(l.cantidad for l in self.lineas)


# ── Primitivas de dibujo ──────────────────────────────────


def _texto(c, x, y, texto, tam=9, color=TINTA, negrita=False):
    c.setFont("Helvetica-Bold" if negrita else "Helvetica", tam)
    c.setFillColor(color)
    c.drawString(x, y, texto)


def _texto_der(c, x, y, texto, tam=9, color=TINTA, negrita=False):
    fuente = "Helvetica-Bold" if negrita else "Helvetica"
    c.setFont(fuente, tam)
    c.setFillColor(color)
    c.drawString(x - stringWidth(texto, fuente, tam), y, texto)


def _texto_centro(c, x, y, texto, tam=9, color=TINTA, negrita=False):
    fuente = "Helvetica-Bold" if negrita else "Helvetica"
    c.setFont(fuente, tam)
    c.setFillColor(color)
    c.drawString(x - stringWidth(texto, fuente, tam) / 2, y, texto)


def _recortar(texto: str, ancho: float, tam: float, negrita=False) -> str:
    """Recorta con puntos suspensivos lo que no entra en la celda.

    Un concepto largo desbordado se mete sobre la columna de al lado y el
    número queda ilegible; recortado, se pierde el final del nombre pero la
    fila se sigue leyendo.
    """
    fuente = "Helvetica-Bold" if negrita else "Helvetica"
    if stringWidth(texto, fuente, tam) <= ancho:
        return texto
    while texto and stringWidth(texto + "…", fuente, tam) > ancho:
        texto = texto[:-1]
    return texto + "…"


# ── Bloques ───────────────────────────────────────────────


def _cinta(c, datos: "DatosFactura") -> None:
    """Cinta diagonal con el estado, cruzando la esquina superior derecha.

    Se dibuja más larga que la esquina a propósito: los extremos quedan fuera
    del área de página y el visor no los muestra, que es más simple y más
    exacto que calcular dónde corta cada borde.
    """
    leyenda, color = CINTA_POR_ESTADO.get(datos.estado, CINTA_POR_ESTADO["emitida"])

    # 46 mm deja la cinta dentro de la esquina y por encima de la razón social
    # del emisor, que cae a 46 mm del borde superior. Agrandarla la tapa.
    distancia = 46 * mm  # a qué altura corta la diagonal cada borde
    grosor = 11 * mm

    c.saveState()
    c.translate(ANCHO - distancia / 2, ALTO - distancia / 2)
    c.rotate(-45)
    c.setFillColor(color)
    c.rect(-100 * mm, -grosor / 2, 200 * mm, grosor, stroke=0, fill=1)
    _texto_centro(c, 0, -3.4, leyenda, tam=11, color=colors.white, negrita=True)
    c.restoreState()


def _cabecera(c, datos: DatosFactura, y: float) -> float:
    """Marca a la izquierda y razón social del emisor a la derecha.

    Sin logo: no hay un archivo de marca en el repositorio, así que va el
    nombre como palabra. Poner una imagen es reemplazar estas dos líneas por un
    `c.drawImage`, con el mismo alto.
    """
    _texto(c, MARGEN, y - 12 * mm, EMISOR, tam=27, color=ACENTO, negrita=True)
    _texto_der(c, ANCHO - MARGEN, y - 26 * mm, EMISOR_LEGAL, tam=12)
    return y - 34 * mm


def _banda_titulo(c, datos: DatosFactura, y: float) -> float:
    """Banda gris con el número y las fechas.

    El número va acá y grande porque es el dato por el que se busca este
    documento: en un correo, en un pago, en un reclamo.
    """
    alto = 26 * mm
    c.setFillColor(GRIS_FONDO)
    c.rect(MARGEN, y - alto, ANCHO_UTIL, alto, stroke=0, fill=1)

    interior = MARGEN + 6 * mm
    _texto(c, interior, y - 10 * mm, f"Orden de compra N° {datos.numero}",
           tam=15, negrita=True)
    _texto(c, interior, y - 16.5 * mm,
           f"Fecha de emisión: {datos.fecha_emision.strftime('%d-%m-%Y')}", tam=9)
    # En el ejemplo esta segunda línea es el vencimiento. Acá no hay plazo de
    # pago en el modelo, y el dato que sí define el cobro es qué mes cubre.
    _texto(c, interior, y - 22 * mm,
           f"Período facturado: {mes_largo(datos.periodo)}", tam=9)

    return y - alto - 12 * mm


def _bloque_cliente(c, datos: DatosFactura, y: float) -> float:
    """"Facturado a" y los datos del cliente, una línea por dato.

    Lo que no está, no se imprime: una etiqueta con la línea vacía al lado
    parece un dato perdido, y acá simplemente no se cargó.
    """
    _texto(c, MARGEN, y, "Facturado a", tam=10, negrita=True)
    y -= 6 * mm

    lineas = [
        datos.razon_social,
        f"RUT: {datos.rut}" if datos.rut else None,
        datos.giro,
        datos.direccion,
        datos.ubicacion,
        datos.correo,
    ]
    for linea in lineas:
        if not linea:
            continue
        _texto(c, MARGEN, y, linea, tam=9)
        y -= 5 * mm

    return y - 8 * mm


# Columnas del detalle, en milímetros. Suman los 170 mm del ancho útil.
# Cuatro y no ocho: el detalle es un concepto por fila, que es como se lee una
# orden de compra y como se discute cuando el cliente pregunta.
_COL_CONCEPTO = 86 * mm
_COL_CANTIDAD = 24 * mm
_COL_UNITARIO = 30 * mm
_COL_TOTAL = 30 * mm
_BORDES = (
    MARGEN,
    MARGEN + _COL_CONCEPTO,
    MARGEN + _COL_CONCEPTO + _COL_CANTIDAD,
    MARGEN + _COL_CONCEPTO + _COL_CANTIDAD + _COL_UNITARIO,
    MARGEN + ANCHO_UTIL,
)

_ALTO_FILA = 9 * mm
_ALTO_RESUMEN = 7.5 * mm
# Debajo de esto no cabe otra fila y hay que pasar de página. Deja sitio para
# el pie, que se dibuja siempre a la misma altura.
_PISO = MARGEN + 26 * mm


def _marco_fila(c, y_techo: float, alto: float, relleno=None, separadores=True) -> None:
    """El rectángulo de una fila y sus divisiones verticales."""
    if relleno is not None:
        c.setFillColor(relleno)
        c.rect(MARGEN, y_techo - alto, ANCHO_UTIL, alto, stroke=0, fill=1)

    c.setStrokeColor(GRIS_LINEA)
    c.setLineWidth(0.6)
    c.rect(MARGEN, y_techo - alto, ANCHO_UTIL, alto, stroke=1, fill=0)
    if separadores:
        for x in _BORDES[1:-1]:
            c.line(x, y_techo - alto, x, y_techo)


def _base(y_techo: float, alto: float, tam: float) -> float:
    """Línea base para que el texto quede centrado en la fila."""
    return y_techo - alto / 2 - tam * 0.36


def _encabezado_tabla(c, y: float) -> float:
    """La fila de títulos. Se repite en cada página: una tabla que sigue en la
    hoja siguiente sin encabezado obliga a volver atrás para saber qué columna
    es cuál."""
    alto = 8 * mm
    _marco_fila(c, y, alto, relleno=GRIS_FONDO)
    base = _base(y, alto, 8.5)
    titulos = ("Descripción", "Cantidad", "Valor unitario", "Total")
    for i, titulo in enumerate(titulos):
        centro = (_BORDES[i] + _BORDES[i + 1]) / 2
        _texto_centro(c, centro, base, titulo, tam=8.5, negrita=True)
    return y - alto


def _fila_detalle(c, linea: LineaFactura, y: float) -> float:
    _marco_fila(c, y, _ALTO_FILA)
    base = _base(y, _ALTO_FILA, 8.5)

    _texto(c, _BORDES[0] + 3 * mm, base,
           _recortar(linea.concepto, _COL_CONCEPTO - 6 * mm, 8.5), tam=8.5)
    _texto_der(c, _BORDES[2] - 3 * mm, base, f"{linea.cantidad}", tam=8.5)
    _texto_der(c, _BORDES[3] - 3 * mm, base, pesos(linea.valor_unitario), tam=8.5)
    _texto_der(c, _BORDES[4] - 3 * mm, base, pesos(linea.valor_total), tam=8.5)
    return y - _ALTO_FILA


def _fila_resumen(c, y: float, etiqueta: str, valor: str,
                  columna: int = 4, fuerte=False) -> float:
    """Fila de cierre: la etiqueta pegada a la derecha de la columna anterior y
    el valor dentro de la columna que le corresponde.

    `columna` existe porque no todos los cierres son plata: el recuento de
    causas va bajo la columna Cantidad, donde se puede comparar con las filas
    de arriba, y no bajo Total, donde parecería un monto sin signo peso.
    """
    _marco_fila(c, y, _ALTO_RESUMEN, relleno=GRIS_FONDO, separadores=False)
    c.setStrokeColor(GRIS_LINEA)
    c.line(_BORDES[columna - 1], y - _ALTO_RESUMEN, _BORDES[columna - 1], y)

    tam = 9.5 if fuerte else 8.5
    base = _base(y, _ALTO_RESUMEN, tam)
    _texto_der(c, _BORDES[columna - 1] - 3 * mm, base, etiqueta, tam=tam, negrita=True)
    _texto_der(c, _BORDES[columna] - 3 * mm, base, valor, tam=tam, negrita=True)
    return y - _ALTO_RESUMEN


def _detalle(c, datos: DatosFactura, y: float) -> float:
    y = _encabezado_tabla(c, y)

    if not datos.lineas:
        # Una orden en cero se imprime igual y lo dice. Una tabla vacía sin
        # explicación parece un PDF que se generó mal.
        _marco_fila(c, y, _ALTO_FILA, separadores=False)
        _texto_centro(c, ANCHO / 2, _base(y, _ALTO_FILA, 8.5),
                      "Sin causas en la cartera del período.", tam=8.5, color=GRIS)
        y -= _ALTO_FILA
    else:
        for linea in datos.lineas:
            # El salto de página se decide antes de dibujar la fila: una fila
            # dibujada a medias sobre el borde es peor que una hoja más.
            if y - _ALTO_FILA < _PISO:
                c.showPage()
                y = _encabezado_tabla(c, ALTO - MARGEN)
            y = _fila_detalle(c, linea, y)

    # Los dos cierres necesitan caber juntos: partirlos entre dos hojas deja un
    # total huérfano en la segunda.
    if y - 2 * _ALTO_RESUMEN < _PISO:
        c.showPage()
        y = ALTO - MARGEN

    # Sin fila de subtotal: el ejemplo la lleva porque descuenta y suma IVA, y
    # acá el subtotal y el total serían el mismo número dos veces. El día que se
    # cobre IVA, las filas van entre estas dos.
    y = _fila_resumen(c, y, "Total de causas", f"{datos.total_causas}", columna=2)
    y = _fila_resumen(c, y, "Total", pesos(datos.total), fuerte=True)

    y -= 6 * mm
    _texto(c, MARGEN, y,
           "Valores por causa y por mes, en pesos chilenos (CLP), según las "
           "tarifas acordadas con el cliente.", tam=7.5, color=GRIS)
    return y - 8 * mm


def _pie(c, datos: DatosFactura) -> None:
    """Pie de página. Dice explícitamente que no es un DTE del SII: un
    documento de cobro que no lo aclara se puede presentar como tributario por
    error."""
    y = MARGEN + 10 * mm
    _texto_centro(c, ANCHO / 2, y,
                  f"PDF generado el {datos.fecha_emision.strftime('%d-%m-%Y')}",
                  tam=8, color=GRIS)

    pie = ("No constituye documento tributario electrónico del SII."
           + (f" Emitida por {datos.emitida_por}." if datos.emitida_por else ""))
    _texto_centro(c, ANCHO / 2, y - 5 * mm, pie, tam=7.5, color=GRIS)


def generar(datos: DatosFactura) -> bytes:
    """Dibuja la orden de compra y devuelve el PDF, protegido contra edición."""
    # Import local: reportlab.lib.pdfencrypt tarda en cargar y solo se usa acá.
    from reportlab.lib.pdfencrypt import StandardEncryption

    buffer = BytesIO()
    c = canvas.Canvas(
        buffer,
        pagesize=A4,
        # Sin clave de usuario: el documento se abre sin pedir nada. Lo que se
        # restringe es qué se puede HACER con él una vez abierto.
        encrypt=StandardEncryption(
            userPassword="",
            ownerPassword=clave_propietario(),
            canPrint=1,
            canModify=0,
            canCopy=0,
            canAnnotate=0,
            strength=128,
        ),
    )
    c.setTitle(f"Orden de compra {datos.numero} - {datos.razon_social}")
    c.setAuthor(EMISOR_LEGAL)
    c.setSubject(f"Período {mes_largo(datos.periodo)}")

    _cinta(c, datos)

    y = ALTO - MARGEN
    y = _cabecera(c, datos, y)
    y = _banda_titulo(c, datos, y)
    y = _bloque_cliente(c, datos, y)
    _detalle(c, datos, y)
    _pie(c, datos)

    c.showPage()
    c.save()
    return buffer.getvalue()
