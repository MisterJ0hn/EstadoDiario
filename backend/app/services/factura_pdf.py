"""Dibujo del PDF de una factura.

Módulo **sin base de datos y sin sesión**: recibe datos ya resueltos y devuelve
bytes. Así el PDF se puede generar y mirar en una prueba sin levantar Postgres,
que es lo único que hace tolerable iterar sobre un diseño impreso.

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
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from app.core.config import settings

# Tamaño de página y márgenes. A4 y no Letter porque es el papel de Chile.
ANCHO, ALTO = A4
MARGEN = 20 * mm

# Paleta mínima: gris para lo secundario, un azul para las líneas de la tabla.
# Una factura no es un folleto; el color solo separa la información.
GRIS = colors.HexColor("#6b7280")
GRIS_CLARO = colors.HexColor("#e5e7eb")
TINTA = colors.HexColor("#111827")
ACENTO = colors.HexColor("#1d4ed8")

MESES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)


def clave_propietario() -> str:
    """Clave de propietario del PDF, derivada y estable.

    Estable a propósito: si cambiara en cada emisión, dos copias de la misma
    factura serían archivos distintos y no se podrían comparar. Va por HMAC con
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


def dia_mes_anio(valor: Optional[date]) -> str:
    return valor.strftime("%d-%m-%Y") if valor else "—"


class LineaFactura:
    """Una fila del detalle. Es un contrato de dibujo, no el modelo ORM: este
    módulo no importa nada de la base para poder probarse solo."""

    def __init__(
        self,
        periodo: date,
        causas_materia: int,
        cortes_apelaciones: int,
        cortes_suprema: int,
        tarifa_materia: int,
        tarifa_apelaciones: int,
        tarifa_suprema: int,
        subtotal: float,
    ):
        self.periodo = periodo
        self.causas_materia = causas_materia
        self.cortes_apelaciones = cortes_apelaciones
        self.cortes_suprema = cortes_suprema
        self.tarifa_materia = tarifa_materia
        self.tarifa_apelaciones = tarifa_apelaciones
        self.tarifa_suprema = tarifa_suprema
        self.subtotal = subtotal


class DatosFactura:
    """Todo lo que se imprime, ya resuelto."""

    def __init__(
        self,
        numero: str,
        fecha_emision: datetime,
        fecha_desde: date,
        fecha_hasta: date,
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
    ):
        self.numero = numero
        self.fecha_emision = fecha_emision
        self.fecha_desde = fecha_desde
        self.fecha_hasta = fecha_hasta
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

    @property
    def ubicacion(self) -> Optional[str]:
        """`Providencia, Santiago`, omitiendo lo que falte."""
        partes = [p for p in (self.comuna, self.ciudad) if p]
        return ", ".join(partes) if partes else None


# ── Dibujo ────────────────────────────────────────────────


def _texto(c, x, y, texto, tam=9, color=TINTA, negrita=False):
    c.setFont("Helvetica-Bold" if negrita else "Helvetica", tam)
    c.setFillColor(color)
    c.drawString(x, y, texto)


def _texto_der(c, x, y, texto, tam=9, color=TINTA, negrita=False):
    fuente = "Helvetica-Bold" if negrita else "Helvetica"
    c.setFont(fuente, tam)
    c.setFillColor(color)
    c.drawString(x - stringWidth(texto, fuente, tam), y, texto)


def _cabecera(c, datos: DatosFactura, y: float) -> float:
    """Emisor a la izquierda, número y fechas en un recuadro a la derecha.

    El número va recuadrado y grande porque es el dato por el que se busca este
    documento: en un correo, en un pago, en un reclamo.
    """
    _texto(c, MARGEN, y, "Temposoft", tam=18, negrita=True)

    # Recuadro del número. El borde SUPERIOR se alinea con el alto de las
    # mayúsculas del título; sin el subtítulo debajo, colgar la caja de la
    # línea base la habría empujado fuera del margen de la página.
    caja_ancho = 62 * mm
    caja_alto = 20 * mm
    caja_x = ANCHO - MARGEN - caja_ancho
    caja_techo = y + 5 * mm
    caja_y = caja_techo - caja_alto

    c.setStrokeColor(ACENTO)
    c.setLineWidth(1)
    c.rect(caja_x, caja_y, caja_ancho, caja_alto, stroke=1, fill=0)

    _texto(c, caja_x + 5 * mm, caja_techo - 6 * mm, "ORDEN DE COMPRA",
           tam=7.5, color=ACENTO, negrita=True)
    _texto(c, caja_x + 5 * mm, caja_techo - 13 * mm, f"N° {datos.numero}",
           tam=15, negrita=True)
    _texto(c, caja_x + 5 * mm, caja_y + 4 * mm,
           f"Emitida el {datos.fecha_emision.strftime('%d-%m-%Y')}", tam=8, color=GRIS)

    return caja_y - 12 * mm


def _bloque_cliente(c, datos: DatosFactura, y: float) -> float:
    """Datos del cliente. Lo que no está, no se imprime: una etiqueta con la
    línea vacía al lado parece un dato perdido, y acá simplemente no se cargó."""
    _texto(c, MARGEN, y, "CLIENTE", tam=8, color=GRIS, negrita=True)
    y -= 6 * mm
    _texto(c, MARGEN, y, datos.razon_social, tam=12, negrita=True)
    y -= 5.5 * mm

    filas = [("RUT", datos.rut), ("Giro", datos.giro), ("Dirección", datos.direccion),
             ("Comuna / Ciudad", datos.ubicacion), ("Correo", datos.correo)]
    for etiqueta, valor in filas:
        if not valor:
            continue
        _texto(c, MARGEN, y, f"{etiqueta}:", tam=9, color=GRIS)
        _texto(c, MARGEN + 32 * mm, y, valor, tam=9)
        y -= 5 * mm

    y -= 2 * mm
    _texto(c, MARGEN, y,
           f"Período facturado: {dia_mes_anio(datos.fecha_desde)} al "
           f"{dia_mes_anio(datos.fecha_hasta)}", tam=9.5, negrita=True)
    return y - 8 * mm


# Columnas del detalle: (encabezado, x relativo al margen, alineación).
# El x es el borde DERECHO en las numéricas, que es como se alinean los números.
_COLUMNAS = [
    ("Período", 0, "izq"),
    ("Materia", 62, "der"),
    ("$", 78, "der"),
    ("Apelac.", 100, "der"),
    ("$", 116, "der"),
    ("Suprema", 140, "der"),
    ("$", 156, "der"),
    ("Subtotal", 170, "der"),
]


def _detalle(c, datos: DatosFactura, y: float) -> float:
    ancho_util = ANCHO - 2 * MARGEN

    _texto(c, MARGEN, y, "DETALLE", tam=8, color=GRIS, negrita=True)
    y -= 6 * mm

    # Encabezado de la tabla
    c.setFillColor(colors.HexColor("#f3f4f6"))
    c.rect(MARGEN, y - 2 * mm, ancho_util, 7 * mm, stroke=0, fill=1)
    for titulo, dx, alineacion in _COLUMNAS:
        x = MARGEN + dx * mm
        if alineacion == "der":
            _texto_der(c, x, y, titulo, tam=7.5, color=GRIS, negrita=True)
        else:
            _texto(c, x, y, titulo, tam=7.5, color=GRIS, negrita=True)
    y -= 8 * mm

    for linea in datos.lineas:
        valores = [
            (mes_largo(linea.periodo), 0, "izq"),
            (f"{linea.causas_materia}", 62, "der"),
            (pesos(linea.causas_materia * linea.tarifa_materia), 78, "der"),
            (f"{linea.cortes_apelaciones}", 100, "der"),
            (pesos(linea.cortes_apelaciones * linea.tarifa_apelaciones), 116, "der"),
            (f"{linea.cortes_suprema}", 140, "der"),
            (pesos(linea.cortes_suprema * linea.tarifa_suprema), 156, "der"),
            (pesos(linea.subtotal), 170, "der"),
        ]
        for texto, dx, alineacion in valores:
            x = MARGEN + dx * mm
            negrita = dx == 170
            if alineacion == "der":
                _texto_der(c, x, y, texto, tam=8.5, negrita=negrita)
            else:
                _texto(c, x, y, texto, tam=8.5, negrita=negrita)

        y -= 3 * mm
        c.setStrokeColor(GRIS_CLARO)
        c.setLineWidth(0.5)
        c.line(MARGEN, y, MARGEN + ancho_util, y)
        y -= 5 * mm

    # Las tarifas, al pie del detalle: sin esto las columnas de pesos son
    # números sin explicación, y son justo lo que un cliente pregunta.
    if datos.lineas:
        t = datos.lineas[0]
        _texto(c, MARGEN, y,
               f"Tarifas aplicadas: causa por materia {pesos(t.tarifa_materia)} · "
               f"Corte de Apelaciones {pesos(t.tarifa_apelaciones)} · "
               f"Corte Suprema {pesos(t.tarifa_suprema)}, por causa y por mes.",
               tam=7.5, color=GRIS)
        y -= 6 * mm

    return y


def _total(c, datos: DatosFactura, y: float) -> float:
    """Caja del total. `y` es el BORDE SUPERIOR de la caja, no una línea base.

    Antes `y` era la base del texto y la caja se dibujaba 6 mm hacia arriba,
    así que se comía la línea de las tarifas que el detalle acababa de escribir
    justo encima. Con `y` como techo, la caja no puede invadir nada de lo de
    arriba por construcción, y no por dejar un hueco calculado a ojo.
    """
    ancho_caja = 80 * mm
    alto_caja = 14 * mm
    x = ANCHO - MARGEN - ancho_caja

    c.setFillColor(colors.HexColor("#f3f4f6"))
    c.rect(x, y - alto_caja, ancho_caja, alto_caja, stroke=0, fill=1)

    base = y - alto_caja + 5 * mm
    _texto(c, x + 5 * mm, base, "TOTAL A PAGAR", tam=9, negrita=True)
    _texto_der(c, ANCHO - MARGEN - 5 * mm, base, pesos(datos.total), tam=14, negrita=True)

    y -= alto_caja + 5 * mm
    _texto_der(c, ANCHO - MARGEN, y, "Valores en pesos chilenos (CLP).", tam=8, color=GRIS)
    return y - 8 * mm


def _pie(c, datos: DatosFactura) -> None:
    """Pie de página. Dice explícitamente que no es un DTE del SII: una factura
    que no lo aclara se puede presentar como tributaria por error."""
    y = MARGEN + 12 * mm
    c.setStrokeColor(GRIS_CLARO)
    c.setLineWidth(0.5)
    c.line(MARGEN, y + 6 * mm, ANCHO - MARGEN, y + 6 * mm)

    _texto(c, MARGEN, y,
           "Orden de compra emitida por el sistema. No constituye documento "
           "tributario electrónico del SII.", tam=7.5, color=GRIS)
    if datos.emitida_por:
        _texto(c, MARGEN, y - 4.5 * mm, f"Emitida por {datos.emitida_por}.",
               tam=7.5, color=GRIS)


def generar(datos: DatosFactura) -> bytes:
    """Dibuja la factura y devuelve el PDF, ya protegido contra edición."""
    # Import local: reportlab.lib.pdfencrypt tarda en cargar y solo se usa acá.
    from reportlab.lib.pdfencrypt import StandardEncryption

    buffer = BytesIO()
    c = canvas.Canvas(
        buffer,
        pagesize=A4,
        # Sin clave de usuario: la factura se abre sin pedir nada. Lo que se
        # restringe es qué se puede HACER con ella una vez abierta.
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
    c.setAuthor("Estado Diario")
    c.setSubject(
        f"Período {dia_mes_anio(datos.fecha_desde)} a {dia_mes_anio(datos.fecha_hasta)}"
    )

    y = ALTO - MARGEN
    y = _cabecera(c, datos, y)
    y = _bloque_cliente(c, datos, y)
    y = _detalle(c, datos, y)
    # Aire entre la nota de tarifas y la caja del total: pegadas, el gris de la
    # caja se lee como si la nota estuviera dentro de ella.
    _total(c, datos, y - 6 * mm)
    _pie(c, datos)

    c.showPage()
    c.save()
    return buffer.getvalue()
