"""Identificación de un adjunto del PJUD: qué reporte es, de qué RUT y de qué fecha.

Antes esto vivía suelto dentro de CorreoService y se apoyaba enteramente en el
nombre del archivo: se probaba el patrón del estado diario, luego el de
movimientos, y el que calzara definía el tipo. Ese acoplamiento se rompió
cuando el PJUD cambió el nombre del reporte de audiencias.

Ahora la fuente primaria es **el asunto del correo**, que cada usuario
configura en su casilla (`asunto_estado_diario`, `asunto_movimientos`,
`asunto_audiencias`). El nombre del archivo pasa a ser respaldo, y para leerlo
se usa un extractor tolerante (`utils.nombre_archivo`) en vez de una expresión
regular por formato.

Cascada de resolución, en orden:

1. **Tipo**: asunto configurado → prefijo del nombre del archivo → indeterminado.
2. **RUT**: nombre del archivo → RUT configurado en la casilla → nulo.
3. **Fecha**: nombre del archivo → contenido del archivo (lo resuelve el
   servicio de importación, que es el único que sabe leerlo) → nulo.
"""

import os
import re
from dataclasses import dataclass
from datetime import date
from typing import Optional

from app.models.configuracion_correo import ConfiguracionCorreo
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.utils.nombre_archivo import extraer_rut_y_fechas

# Respaldo cuando el asunto no alcanza para clasificar: cómo empieza el nombre
# de cada reporte. Deliberadamente laxo (solo el prefijo, sin el resto del
# formato) porque el formato es justamente lo que cambia.
_PREFIJOS = (
    (EstadoDiarioOrigen.TIPO_AUDIENCIAS, re.compile(r"audiencia", re.IGNORECASE)),
    (EstadoDiarioOrigen.TIPO_MOVIMIENTOS, re.compile(r"movimiento", re.IGNORECASE)),
    (EstadoDiarioOrigen.TIPO_ESTADO_DIARIO, re.compile(r"estado\s*_?diario", re.IGNORECASE)),
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
    # De dónde salió el tipo ("asunto" o "nombre"), para la bitácora.
    origen_tipo: Optional[str] = None

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


def detectar(
    filename: str,
    asunto: str,
    config: ConfiguracionCorreo,
) -> ArchivoDetectado:
    """Identifica el adjunto combinando asunto, nombre y configuración."""
    tipo = detectar_tipo_por_asunto(asunto, config)
    origen_tipo = "asunto" if tipo else None

    if tipo is None:
        tipo = detectar_tipo_por_nombre(filename)
        origen_tipo = "nombre" if tipo else None

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
    )


def explicar_no_reconocido(config: ConfiguracionCorreo) -> str:
    """Mensaje para la bitácora cuando no se pudo clasificar el adjunto.

    Dice qué le falta a ESTA casilla, no un texto genérico: si el usuario no
    configuró ningún asunto, el consejo útil es que los configure, no que
    revise el nombre del archivo.
    """
    if not config.asuntos_por_tipo:
        return (
            "No se pudo determinar el tipo de reporte. Configure en su casilla el "
            "asunto que identifica a cada uno (estado diario, movimientos y "
            "audiencias); el nombre del archivo ya no alcanza porque el PJUD lo "
            "cambia sin aviso."
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
        "El asunto del correo no coincide con ninguno de los configurados y el "
        f"nombre del archivo tampoco identifica el reporte.{detalle}"
    )
