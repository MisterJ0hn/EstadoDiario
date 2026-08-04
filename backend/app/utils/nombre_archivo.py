"""Extracción de RUT y fechas del nombre de un archivo del PJUD.

Los reportes del PJUD han cambiado de nombre más de una vez y sin aviso:

    estadoDiario_16952077__28072026.xls
    EstadoDiario17314741-4_15_07_2026.xls
    Movimientos_16952077__30_07_2026.xls
    Audiencias_16952077_03_08_2026_09_08_2026.xls

Por eso acá NO hay una expresión regular por formato, sino un extractor
tolerante: busca en el nombre lo que parezca un RUT y lo que parezca una fecha,
en el orden en que aparecen. Así un cambio de prefijo o de separadores no
vuelve a romper la importación.

Lo que este módulo NO hace es decidir el TIPO de reporte: de eso se encarga
`deteccion_archivo`, que usa el asunto del correo configurado por el usuario.
"""

import os
import re
from datetime import date
from typing import Optional

# Un RUT chileno sin puntos: 7 u 8 dígitos de cuerpo y un dígito verificador
# opcional (que puede ser K). El DV solo se reconoce cuando viene separado por
# guion; pegado sería indistinguible del resto de los dígitos del nombre.
_PATRON_RUT = re.compile(r"(?<!\d)(\d{7,8})(?:-([\dkK]))?(?!\d)")

# Fechas con separador: 03_08_2026 / 03-08-2026 / 2026-08-03
_PATRON_FECHA_SEPARADA = re.compile(
    r"(?<!\d)(\d{1,4})[_\-./](\d{1,2})[_\-./](\d{2,4})(?!\d)"
)

# Fechas pegadas de 8 dígitos: 28072026 (DDMMYYYY) o 20260728 (YYYYMMDD)
_PATRON_FECHA_PEGADA = re.compile(r"(?<!\d)(\d{8})(?!\d)")


def _fecha_valida(anio: int, mes: int, dia: int) -> Optional[date]:
    try:
        return date(anio, mes, dia)
    except ValueError:
        return None


def _interpretar_pegada(digitos: str) -> Optional[date]:
    """8 dígitos seguidos: se prueba DDMMYYYY y luego YYYYMMDD.

    DDMMYYYY primero porque es el formato del estado diario, que es el que de
    verdad usa esta forma.
    """
    dia, mes, anio = int(digitos[0:2]), int(digitos[2:4]), int(digitos[4:8])
    fecha = _fecha_valida(anio, mes, dia)
    if fecha:
        return fecha

    anio, mes, dia = int(digitos[0:4]), int(digitos[4:6]), int(digitos[6:8])
    return _fecha_valida(anio, mes, dia)


def _interpretar_separada(a: str, b: str, c: str) -> Optional[date]:
    """Tres grupos separados. Se decide por el largo: el grupo de 4 dígitos es
    el año, y si el año va primero el orden es YYYY-MM-DD."""
    if len(a) == 4:
        return _fecha_valida(int(a), int(b), int(c))

    anio = int(c)
    if len(c) == 2:
        # Año de dos dígitos: 26 -> 2026. El PJUD no reporta nada anterior a
        # 2000, así que no hace falta una ventana móvil.
        anio += 2000
    return _fecha_valida(anio, int(b), int(a))


def _buscar_separadas(nombre: str) -> list[tuple[int, int, date]]:
    """(inicio, fin, fecha) de cada fecha con separador.

    No usa `finditer`: cuando un candidato calza con la forma pero no es una
    fecha real, el avance tiene que ser de UN carácter y no del largo del
    match. Si no, en "17314741-4_15_07_2026" el candidato inválido "4_15_07"
    se traga el "15_07" y la fecha buena se pierde.
    """
    encontradas: list[tuple[int, int, date]] = []
    pos = 0
    while pos < len(nombre):
        m = _PATRON_FECHA_SEPARADA.search(nombre, pos)
        if not m:
            break
        fecha = _interpretar_separada(*m.groups())
        if fecha:
            encontradas.append((m.start(), m.end(), fecha))
            pos = m.end()
        else:
            pos = m.start() + 1
    return encontradas


def fechas_en_texto(texto: str) -> list[date]:
    """Fechas encontradas en un texto cualquiera, en orden y sin repetir.

    Separada de `extraer_fechas` porque el asunto del correo también sirve de
    fuente y ahí NO hay que quitar ninguna extensión: un asunto como
    "Informe v1.2 del 03-08-2026" perdería media línea si se le aplicara
    splitext.
    """
    nombre = texto or ""

    separadas = _buscar_separadas(nombre)
    encontradas: list[tuple[int, date]] = [(ini, f) for ini, _, f in separadas]

    # Las pegadas se buscan solo donde no llegaron las separadas, para que
    # "15_07_2026" no aporte además un falso bloque de 8 dígitos.
    for m in _PATRON_FECHA_PEGADA.finditer(nombre):
        if any(ini <= m.start() < fin for ini, fin, _ in separadas):
            continue
        fecha = _interpretar_pegada(m.group(1))
        if fecha:
            encontradas.append((m.start(), fecha))

    encontradas.sort(key=lambda par: par[0])

    ordenadas: list[date] = []
    for _, fecha in encontradas:
        if fecha not in ordenadas:
            ordenadas.append(fecha)
    return ordenadas


def extraer_fechas(filename: str) -> list[date]:
    """Fechas del nombre de un archivo, en orden de aparición y sin repetir.

    Sirve tanto para el reporte de un día (una fecha) como para el de
    audiencias, que trae el rango completo (dos fechas).
    """
    return fechas_en_texto(os.path.splitext(filename or "")[0])


def rut_en_texto(texto: str) -> Optional[str]:
    """Primer RUT que aparezca en un texto cualquiera.

    El problema es que una fecha pegada (28072026) también son 8 dígitos, así
    que se descarta cualquier candidato que sea una fecha válida y solo se cae
    en él si no quedó ninguna otra opción. En todos los nombres conocidos el
    RUT va antes que las fechas, así que "el primero" es el criterio correcto.
    """
    nombre = texto or ""

    respaldo: Optional[str] = None
    for m in _PATRON_RUT.finditer(nombre):
        cuerpo, dv = m.group(1), m.group(2)
        rut = f"{cuerpo}-{dv}" if dv else cuerpo

        # Con dígito verificador explícito no hay ambigüedad posible: ninguna
        # fecha se escribe así.
        if dv:
            return rut
        if len(cuerpo) == 8 and _interpretar_pegada(cuerpo):
            respaldo = respaldo or rut
            continue
        return rut

    return respaldo


def extraer_rut(filename: str) -> Optional[str]:
    """Primer RUT del nombre de un archivo."""
    return rut_en_texto(os.path.splitext(filename or "")[0])


def extraer_rut_y_fechas(
    filename: str,
    texto_alternativo: str = "",
) -> tuple[Optional[str], Optional[date], Optional[date]]:
    """(rut, primera_fecha, segunda_fecha); None en lo que falte.

    `texto_alternativo` es el asunto del correo, que se consulta solo por lo
    que el nombre del archivo no haya dado. Sirve porque los correos del PJUD
    suelen llevar el dato en el asunto ("Estado Diario del 28-07-2026") y así un
    cambio de nombre de archivo no deja al reporte sin fecha.

    El nombre manda sobre el asunto: un correo puede traer varios adjuntos de
    fechas distintas, y ahí lo que identifica a cada uno es su propio nombre.

    La segunda fecha solo la traen los reportes de rango (audiencias). Quien
    llama decide qué hacer con lo que falte: el RUT puede venir de la
    configuración de la casilla y la fecha del contenido del archivo.
    """
    nombre = os.path.splitext(filename or "")[0]

    rut = rut_en_texto(nombre)
    fechas = fechas_en_texto(nombre)

    if texto_alternativo and (rut is None or not fechas):
        rut = rut or rut_en_texto(texto_alternativo)
        fechas = fechas or fechas_en_texto(texto_alternativo)

    return (
        rut,
        fechas[0] if fechas else None,
        fechas[1] if len(fechas) > 1 else None,
    )
