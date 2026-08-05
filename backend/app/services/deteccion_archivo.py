"""Identificación de un adjunto del PJUD: qué reporte es, de qué RUT y de qué fecha.

Antes esto vivía suelto dentro de CorreoService y se apoyaba enteramente en el
nombre del archivo: se probaba el patrón del estado diario, luego el de
movimientos, y el que calzara definía el tipo. Ese acoplamiento se rompió
cuando el PJUD cambió el nombre del reporte de audiencias.

Después se apoyó en **el asunto del correo**, que cada usuario configura en su
casilla (`asunto_estado_diario`, `asunto_movimientos`, `asunto_audiencias`).
Eso también se rompió: un asunto configurado de más (dos textos que calzan con
el mismo correo, o uno tan genérico que calza con los tres) manda el archivo al
parser equivocado. Y como los encabezados de movimientos son un subconjunto de
los que acepta el parser del estado diario, el archivo entra **sin error**: se
graba como estado diario y nadie se entera.

Por eso la fuente primaria hoy es **el contenido del archivo**. Los tres
reportes tienen columnas propias ("Estado Causa" e "Institución" solo en
movimientos, "Tipo Recurso" y "Rol Único" solo en el estado diario, cualquier
cosa con "audiencia" solo en audiencias), y esas columnas no cambian cuando el
PJUD renombra un archivo ni cuando el usuario configura mal un asunto.

Cascada de resolución, en orden:

1. **Tipo**: contenido del archivo → asunto configurado → prefijo del nombre →
   indeterminado. Contenido y asunto/nombre casi siempre coinciden; cuando no,
   manda el contenido y la discrepancia queda en la bitácora.
2. **RUT**: nombre del archivo → RUT configurado en la casilla → nulo.
3. **Fecha**: nombre del archivo → contenido del archivo (lo resuelve el
   servicio de importación, que es el único que sabe leerlo) → nulo.
"""

import os
import re
from dataclasses import dataclass
from datetime import date
from typing import Optional

from app.models.maestra.configuracion_correo import ConfiguracionCorreo
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.utils.excel_pjud import encabezados_por_hoja
from app.utils.nombre_archivo import extraer_rut_y_fechas

# Respaldo cuando el asunto no alcanza para clasificar: cómo empieza el nombre
# de cada reporte. Deliberadamente laxo (solo el prefijo, sin el resto del
# formato) porque el formato es justamente lo que cambia.
_PREFIJOS = (
    (EstadoDiarioOrigen.TIPO_AUDIENCIAS, re.compile(r"audiencia", re.IGNORECASE)),
    (EstadoDiarioOrigen.TIPO_MOVIMIENTOS, re.compile(r"movimiento", re.IGNORECASE)),
    (EstadoDiarioOrigen.TIPO_ESTADO_DIARIO, re.compile(r"estado\s*_?diario", re.IGNORECASE)),
)

# Encabezados que aparecen en UN solo reporte. Se comparan como subcadena del
# encabezado normalizado (sin tildes, en minúsculas), para que "Tipo/Audiencia"
# y "Fecha Audiencia" cuenten igual.
#
# Deliberadamente cortos: acá solo van columnas exclusivas. Las que comparten
# dos reportes ("Rol", "Tribunal", "Caratulado", "Fecha Ingreso", "Estado") no
# sirven para distinguir y quedan fuera; también quedó fuera "Ubicación", que
# el parser de movimientos acepta aunque los archivos de hoy no la traigan.
_MARCAS_CONTENIDO = (
    (EstadoDiarioOrigen.TIPO_AUDIENCIAS, ("audiencia",)),
    (EstadoDiarioOrigen.TIPO_MOVIMIENTOS, ("estado causa", "estado de causa", "institucion")),
    (EstadoDiarioOrigen.TIPO_ESTADO_DIARIO, ("tipo recurso", "rol unico", "rol interno", "tipo causa")),
)

# Cómo se llama cada tipo en los mensajes que ve el usuario.
ETIQUETAS = {
    EstadoDiarioOrigen.TIPO_ESTADO_DIARIO: "estado diario",
    EstadoDiarioOrigen.TIPO_MOVIMIENTOS: "movimientos",
    EstadoDiarioOrigen.TIPO_AUDIENCIAS: "audiencias",
}


@dataclass(frozen=True)
class ArchivoDetectado:
    """Resultado de identificar un adjunto. Inmutable: es un dato, no un estado."""

    tipo: Optional[str]
    rut: Optional[str]
    fecha: Optional[date]
    # Solo la traen los reportes de rango (audiencias); hoy es informativa.
    fecha_hasta: Optional[date] = None
    # De dónde salió el tipo ("contenido", "asunto" o "nombre"), para la bitácora.
    origen_tipo: Optional[str] = None
    # Qué decían el asunto y el nombre cuando el contenido dijo otra cosa. Es
    # el síntoma de una casilla mal configurada, y hay que poder verlo.
    tipo_descartado: Optional[str] = None

    @property
    def reconocido(self) -> bool:
        return self.tipo is not None

    @property
    def etiqueta(self) -> str:
        return ETIQUETAS.get(self.tipo or "", "desconocido")


def detectar_tipo_por_asunto(asunto: str, config: ConfiguracionCorreo) -> Optional[str]:
    """Tipo según los asuntos configurados por el usuario, o None.

    Si dos configuraciones calzan con el mismo asunto gana la más larga: es la
    más específica. Sin esto, configurar "Audiencias" y "Audiencias Penales"
    haría que el resultado dependiera del orden del diccionario.
    """
    asunto_normalizado = (asunto or "").lower()
    if not asunto_normalizado:
        return None

    coincidencias = [
        (tipo, texto)
        for tipo, texto in config.asuntos_por_tipo.items()
        if texto.lower() in asunto_normalizado
    ]
    if not coincidencias:
        return None

    return max(coincidencias, key=lambda par: len(par[1]))[0]


def detectar_tipo_por_nombre(filename: str) -> Optional[str]:
    """Tipo según el nombre del archivo. Respaldo del asunto.

    Audiencias se evalúa primero porque es el nombre que ya cambió una vez: si
    mañana vuelve a cambiar y empieza a contener otra palabra, es preferible
    que caiga en "indeterminado" y no que se confunda con otro reporte.
    """
    nombre = os.path.basename(filename or "")
    for tipo, patron in _PREFIJOS:
        if patron.search(nombre):
            return tipo
    return None


def detectar_tipo_por_contenido(file_path: str) -> Optional[str]:
    """Tipo según las columnas del archivo, o None si no es concluyente.

    Se cuentan las columnas exclusivas de cada reporte en todas las hojas y
    gana el que tenga más. Se exige ganador único: un empate significa que el
    archivo no se parece más a uno que a otro, y ahí es preferible devolver
    None y dejar que decidan el asunto o el nombre.

    Un archivo puede no tener ninguna columna exclusiva (el estado diario de un
    RUT con causas solo civiles es un ejemplo real) y eso tampoco es un error:
    también devuelve None.
    """
    if not file_path:
        return None

    puntajes: dict[str, int] = {}
    for encabezados in encabezados_por_hoja(file_path):
        for tipo, marcas in _MARCAS_CONTENIDO:
            aciertos = sum(
                1 for cabecera in encabezados for marca in marcas if marca in cabecera
            )
            if aciertos:
                puntajes[tipo] = puntajes.get(tipo, 0) + aciertos

    if not puntajes:
        return None

    ordenados = sorted(puntajes.items(), key=lambda par: par[1], reverse=True)
    if len(ordenados) > 1 and ordenados[0][1] == ordenados[1][1]:
        return None
    return ordenados[0][0]


def detectar(
    filename: str,
    asunto: str,
    config: ConfiguracionCorreo,
    file_path: Optional[str] = None,
) -> ArchivoDetectado:
    """Identifica el adjunto combinando contenido, asunto, nombre y configuración.

    `file_path` es opcional para poder clasificar sin tener el archivo en
    disco (los tests de asunto y nombre lo hacen así), pero en la ingesta real
    siempre se pasa: es la fuente que no miente.
    """
    tipo_declarado = detectar_tipo_por_asunto(asunto, config)
    origen_declarado = "asunto" if tipo_declarado else None

    if tipo_declarado is None:
        tipo_declarado = detectar_tipo_por_nombre(filename)
        origen_declarado = "nombre" if tipo_declarado else None

    # El contenido manda sobre lo que digan el asunto y el nombre. Al revés, un
    # asunto mal configurado alcanza para grabar movimientos como estado
    # diario: los encabezados de aquél son un subconjunto de los que acepta el
    # parser de éste, así que la importación no falla, queda mal.
    tipo_contenido = detectar_tipo_por_contenido(file_path) if file_path else None

    if tipo_contenido:
        tipo, origen_tipo = tipo_contenido, "contenido"
        tipo_descartado = tipo_declarado if tipo_declarado != tipo_contenido else None
    else:
        tipo, origen_tipo, tipo_descartado = tipo_declarado, origen_declarado, None

    # El asunto es la segunda fuente para el RUT y la fecha: los correos del
    # PJUD suelen llevarlos ahí ("Estado Diario del 28-07-2026"), así que un
    # cambio de nombre de archivo no deja al reporte sin fecha.
    rut_nombre, fecha, fecha_hasta = extraer_rut_y_fechas(filename, asunto)

    # El RUT de la casilla es un respaldo, no un reemplazo: si el nombre trae
    # uno, ese manda. Un archivo reenviado de otro RUT debe conservar el suyo.
    rut = rut_nombre or (config.rut.strip() if config.rut and config.rut.strip() else None)

    return ArchivoDetectado(
        tipo=tipo,
        rut=rut,
        fecha=fecha,
        fecha_hasta=fecha_hasta,
        origen_tipo=origen_tipo,
        tipo_descartado=tipo_descartado,
    )


def verificar_contenido(file_path: str, tipo_esperado: str) -> Optional[str]:
    """Mensaje de error si el archivo es de OTRO reporte, o None si está bien.

    Es la red de seguridad de la carga manual, donde el tipo lo elige una
    persona en un `<select>` y puede equivocarse. No exige que el contenido
    confirme el tipo (hay archivos sin columnas exclusivas): solo rechaza los
    que dicen ser de otro.
    """
    tipo_real = detectar_tipo_por_contenido(file_path)
    if tipo_real is None or tipo_real == tipo_esperado:
        return None

    return (
        f"El archivo no es un reporte de {ETIQUETAS.get(tipo_esperado, tipo_esperado)}: "
        f"sus columnas corresponden a {ETIQUETAS.get(tipo_real, tipo_real)}. "
        f"Cárguelo como {ETIQUETAS.get(tipo_real, tipo_real)}."
    )


def explicar_no_reconocido(config: ConfiguracionCorreo) -> str:
    """Mensaje para la bitácora cuando no se pudo clasificar el adjunto.

    Dice qué le falta a ESTA casilla, no un texto genérico: si el usuario no
    configuró ningún asunto, el consejo útil es que los configure, no que
    revise el nombre del archivo.
    """
    if not config.asuntos_por_tipo:
        return (
            "No se pudo determinar el tipo de reporte: el archivo no trae ninguna "
            "columna que lo identifique y el nombre tampoco. Configure en su "
            "casilla el asunto que identifica a cada uno (estado diario, "
            "movimientos y audiencias)."
        )

    faltantes = [
        ETIQUETAS[tipo]
        for tipo in (
            EstadoDiarioOrigen.TIPO_ESTADO_DIARIO,
            EstadoDiarioOrigen.TIPO_MOVIMIENTOS,
            EstadoDiarioOrigen.TIPO_AUDIENCIAS,
        )
        if tipo not in config.asuntos_por_tipo
    ]
    detalle = (
        f" Le falta configurar el asunto de: {', '.join(faltantes)}." if faltantes else ""
    )
    return (
        "Las columnas del archivo no identifican el reporte, el asunto del correo "
        "no coincide con ninguno de los configurados y el nombre del archivo "
        f"tampoco.{detalle}"
    )
