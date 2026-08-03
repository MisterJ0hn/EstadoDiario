"""Plomería compartida para leer los Excel que publica el PJUD.

Los tres reportes que maneja el sistema (estado diario, movimientos y
audiencias) llegan con las mismas rarezas:

* La extensión miente sobre el formato real: hay ".xls" que son XLSX. El
  formato se detecta por magic bytes, nunca por el nombre.
* Traen una hoja por materia y el orden de las columnas cambia entre hojas.
* Los encabezados varían en tildes, mayúsculas y espacios ("Institución" /
  "Institucion", "Fecha audiencia" / "Fecha Audiencia"). El mapeo va siempre
  por encabezado normalizado, jamás por posición.
* Las fechas y horas llegan como texto, salvo que alguien reguarde el archivo
  desde Excel: ahí pasan a ser celdas numéricas (serial de fecha).

Este módulo concentra todo eso para que cada parser se ocupe solo de su
propio mapeo de campos.
"""

import os
import re
import unicodedata
from datetime import date, datetime, time
from typing import Optional

import xlrd

# Formatos con los que llega una fecha como texto. Los archivos reales usan
# "2018/01/12" (movimientos) y "07/08/2026" (audiencias); los demás se aceptan
# para no depender de una sola versión del reporte.
FORMATOS_FECHA = ("%Y/%m/%d", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y")

FORMATOS_HORA = ("%H:%M", "%H:%M:%S", "%H.%M")


def normalizar_encabezado(valor) -> str:
    """Minúsculas, sin tildes y sin espacios de más, para poder comparar
    "Institución", "Institucion" e "INSTITUCION " como el mismo encabezado."""
    if valor is None:
        return ""
    texto = unicodedata.normalize("NFKD", str(valor))
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", texto).strip().lower()


def detectar_formato(file_path: str) -> str:
    """Devuelve 'xlsx' o 'xls' leyendo los magic bytes.

    No renombra el archivo (a diferencia de ImportService._ensure_correct_
    extension) porque ni xlrd ni openpyxl miran la extensión: alcanza con
    elegir la librería correcta, y así la función sirve también para archivos
    de solo lectura.
    """
    with open(file_path, "rb") as f:
        cabecera = f.read(8)

    if cabecera[:2] == b"PK":
        return "xlsx"
    if cabecera[:4] == b"\xd0\xcf\x11\xe0":
        return "xls"
    # Sin firma reconocible: se cae a la extensión.
    return "xlsx" if os.path.splitext(file_path)[1].lower() in (".xlsx", ".xlsm") else "xls"


def recortar(valor: Optional[str], campo: str, largos: dict[str, int]) -> Optional[str]:
    """Recorta al largo de la columna del modelo.

    El Excel del PJUD a veces trae textos rellenos con espacios o más largos
    de lo esperado: se recortan en vez de reventar el INSERT.
    """
    largo = largos.get(campo)
    if valor and largo and len(valor) > largo:
        return valor[:largo]
    return valor


def parse_fecha_texto(valor) -> Optional[date]:
    texto = str(valor).strip()
    if not texto:
        return None
    # Algunas celdas traen la hora pegada ("2018/01/12 00:00:00").
    texto = texto.split(" ")[0]
    for formato in FORMATOS_FECHA:
        try:
            return datetime.strptime(texto, formato).date()
        except ValueError:
            continue
    return None


def parse_hora_texto(valor) -> Optional[time]:
    texto = str(valor).strip()
    if not texto:
        return None
    # "07/08/2026 10:00" -> se queda con lo que parezca hora.
    if " " in texto:
        texto = texto.split(" ")[-1]
    for formato in FORMATOS_HORA:
        try:
            return datetime.strptime(texto, formato).time()
        except ValueError:
            continue
    return None


def parse_fecha_xls(valor, datemode) -> Optional[date]:
    """Fecha de una celda de un .xls OLE2, venga como texto o como serial."""
    if valor is None or valor == "":
        return None
    if isinstance(valor, (int, float)):
        try:
            return xlrd.xldate_as_datetime(valor, datemode).date()
        except Exception:
            return None
    return parse_fecha_texto(valor)


def parse_hora_xls(valor, datemode) -> Optional[time]:
    """Hora de una celda de un .xls OLE2.

    Cuando Excel guarda una hora suelta la deja como fracción de día (0.5 =
    12:00), que xldate_as_datetime resuelve sobre la fecha base del libro; solo
    interesa la parte horaria.
    """
    if valor is None or valor == "":
        return None
    if isinstance(valor, (int, float)):
        try:
            return xlrd.xldate_as_datetime(valor, datemode).time()
        except Exception:
            return None
    return parse_hora_texto(valor)


def parse_fecha_xlsx(valor) -> Optional[date]:
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    return parse_fecha_texto(valor)


def parse_hora_xlsx(valor) -> Optional[time]:
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        return valor.time()
    if isinstance(valor, time):
        return valor
    return parse_hora_texto(valor)


def mapa_columnas(encabezados: list, alias: dict[str, str]) -> dict[int, str]:
    """índice de columna -> campo del modelo, para los encabezados conocidos.

    Si dos columnas mapean al mismo campo gana la primera: en las hojas del
    PJUD la repetición es siempre un encabezado residual a la derecha.
    """
    mapa: dict[int, str] = {}
    for idx, bruto in enumerate(encabezados):
        campo = alias.get(normalizar_encabezado(bruto))
        if campo and campo not in mapa.values():
            mapa[idx] = campo
    return mapa
