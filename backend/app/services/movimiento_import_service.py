"""Importación del Excel de "Movimientos".

Es un reporte distinto al estado diario: lista el universo de causas vigentes
de un RUT con su estado procesal. Diferencias que condicionan este parser:

* El archivo real es un .xls OLE2 (el del estado diario es un XLSX con
  extensión .xls mentida), así que el formato se detecta por magic bytes y no
  por la extensión.
* Trae una hoja por materia y la materia NO viene como columna: es el nombre
  de la hoja.
* El orden de las columnas cambia entre hojas (en Familia, "Fecha Ingreso" va
  antes que "Caratulado") y los encabezados varían en tildes y mayúsculas
  ("Institución"/"Institucion", "Estado Causa"/"Estado causa"). Por eso el
  mapeo es por nombre normalizado de encabezado, nunca por posición.
* Varias hojas vienen solo con el encabezado; se saltan sin error.
"""

import logging
import os
import re
import unicodedata
from datetime import datetime, timezone, date
from typing import Optional

import xlrd
import openpyxl
from sqlalchemy.orm import Session

from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.movimiento import Movimiento
from app.repositories.movimiento_repository import MovimientoRepository
from app.repositories.jurisdiccion_repository import JurisdiccionRepository

logger = logging.getLogger(__name__)

# Encabezado normalizado (minúsculas, sin tildes, sin espacios repetidos) ->
# campo del modelo Movimiento. "Rit" en primera instancia y "Rol" en las
# cortes son la misma columna lógica.
HEADER_ALIASES = {
    "rit": "rol",
    "rol": "rol",
    "era": "era",
    "tribunal": "tribunal",
    "corte": "corte",
    "caratulado": "caratulado",
    "fecha ingreso": "fecha_ingreso",
    "fecha de ingreso": "fecha_ingreso",
    "estado causa": "estado_causa",
    "estado de causa": "estado_causa",
    "estado": "estado_causa",
    "institucion": "institucion",
    "ubicacion": "ubicacion",
    "fecha ubicacion": "fecha_ubicacion",
}

CAMPOS_FECHA = ("fecha_ingreso", "fecha_ubicacion")

# Largos de las columnas del modelo. El Excel del PJUD a veces trae textos
# rellenos con espacios o más largos de lo esperado: se recortan en vez de
# reventar el INSERT.
LARGOS_MAXIMOS = {
    "materia": 100,
    "rol": 100,
    "era": 20,
    "tribunal": 255,
    "corte": 255,
    "caratulado": 255,
    "estado_causa": 100,
    "institucion": 255,
    "ubicacion": 255,
}

# Formatos con los que llegan las fechas como texto. El archivo real usa
# "2018/01/12" (año primero), pero se aceptan los otros para no depender de
# una sola versión del reporte.
FORMATOS_FECHA = ("%Y/%m/%d", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y")


def normalizar_encabezado(valor) -> str:
    """Minúsculas, sin tildes y sin espacios de más, para poder comparar
    "Institución", "Institucion" e "INSTITUCION " como el mismo encabezado."""
    if valor is None:
        return ""
    texto = unicodedata.normalize("NFKD", str(valor))
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", texto).strip().lower()


def _detectar_formato(file_path: str) -> str:
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


def _recortar(valor: Optional[str], campo: str) -> Optional[str]:
    largo = LARGOS_MAXIMOS.get(campo)
    if valor and largo and len(valor) > largo:
        return valor[:largo]
    return valor


def _parse_fecha_texto(valor) -> Optional[date]:
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


def _parse_fecha_xls(valor, datemode) -> Optional[date]:
    """El reporte trae las fechas como texto, pero si alguien reguarda el
    archivo desde Excel pasan a ser celdas de fecha reales (float serial)."""
    if valor is None or valor == "":
        return None
    if isinstance(valor, float) or isinstance(valor, int):
        try:
            return xlrd.xldate_as_datetime(valor, datemode).date()
        except Exception:
            return None
    return _parse_fecha_texto(valor)


def _parse_fecha_xlsx(valor) -> Optional[date]:
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    return _parse_fecha_texto(valor)


def _mapa_columnas(encabezados: list) -> dict:
    """índice de columna -> campo del modelo, para los encabezados conocidos."""
    mapa = {}
    for idx, bruto in enumerate(encabezados):
        campo = HEADER_ALIASES.get(normalizar_encabezado(bruto))
        if campo and campo not in mapa.values():
            mapa[idx] = campo
    return mapa


def _armar_fila(valores_por_campo: dict, materia: str) -> Optional[dict]:
    """Devuelve la fila lista para persistir, o None si venía vacía."""
    if not any(v not in (None, "") for v in valores_por_campo.values()):
        return None
    fila = {"materia": _recortar(materia.strip(), "materia")}
    fila.update(valores_por_campo)
    return fila


def _leer_xls(file_path: str) -> list[dict]:
    wb = xlrd.open_workbook(file_path)
    filas: list[dict] = []
    for hoja in wb.sheets():
        if hoja.nrows < 2:  # solo encabezado (o vacía)
            continue

        mapa = _mapa_columnas([hoja.cell_value(0, c) for c in range(hoja.ncols)])
        if not mapa:
            continue

        for r in range(1, hoja.nrows):
            valores = {}
            for col, campo in mapa.items():
                bruto = hoja.cell_value(r, col)
                if campo in CAMPOS_FECHA:
                    valores[campo] = _parse_fecha_xls(bruto, wb.datemode)
                else:
                    texto = str(bruto).strip() if bruto not in (None, "") else None
                    valores[campo] = _recortar(texto or None, campo)

            fila = _armar_fila(valores, hoja.name)
            if fila:
                filas.append(fila)
    return filas


def _leer_xlsx(file_path: str) -> list[dict]:
    wb = openpyxl.load_workbook(file_path, data_only=True)
    try:
        filas: list[dict] = []
        for nombre_hoja in wb.sheetnames:
            hoja = wb[nombre_hoja]
            if not hoja.max_row or hoja.max_row < 2:
                continue

            ncols = hoja.max_column or 0
            mapa = _mapa_columnas([hoja.cell(1, c).value for c in range(1, ncols + 1)])
            if not mapa:
                continue

            for r in range(2, hoja.max_row + 1):
                valores = {}
                for col, campo in mapa.items():
                    bruto = hoja.cell(r, col + 1).value  # openpyxl es 1-based
                    if campo in CAMPOS_FECHA:
                        valores[campo] = _parse_fecha_xlsx(bruto)
                    else:
                        texto = str(bruto).strip() if bruto not in (None, "") else None
                        valores[campo] = _recortar(texto or None, campo)

                fila = _armar_fila(valores, nombre_hoja)
                if fila:
                    filas.append(fila)
        return filas
    finally:
        wb.close()


def parse_movimientos_file(file_path: str) -> list[dict]:
    """Parsea el Excel de movimientos a una lista de dicts.

    Función pura (no toca la base de datos) para poder probar el parseo del
    archivo por separado.
    """
    if _detectar_formato(file_path) == "xlsx":
        return _leer_xlsx(file_path)
    return _leer_xls(file_path)


def parse_nombre_archivo(filename: str) -> tuple[Optional[str], Optional[date]]:
    """Extrae RUT y fecha del nombre, formato Movimientos_{RUT}_{DD}_{MM}_{YYYY}.xls.

    El archivo real trae doble guion bajo cuando el RUT viene sin dígito
    verificador (Movimientos_16952077__30_07_2026.xls), de ahí el `_+`.
    """
    nombre = os.path.splitext(filename or "")[0]
    m = re.match(
        r"^Movimientos_(\d+(?:[\-]?[0-9kK])?)_+(\d{1,2})_(\d{1,2})_(\d{4})$",
        nombre,
        re.IGNORECASE,
    )
    if not m:
        return None, None
    try:
        return m.group(1), date(int(m.group(4)), int(m.group(3)), int(m.group(2)))
    except ValueError:
        return m.group(1), None


class MovimientoImportService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = MovimientoRepository(db)
        self.jurisdiccion_repo = JurisdiccionRepository(db)

    def import_file(
        self,
        file_path: str,
        rut: str,
        fecha: date,
        usuario_id: Optional[int] = None,
        nombre_archivo: Optional[str] = None,
    ) -> dict:
        """Importa un archivo de movimientos y devuelve el resumen de la carga.

        Mismo contrato que ImportService.import_file: rechaza duplicados y
        parsea ANTES de crear el origen, para que un archivo ilegible no deje
        una fila huérfana sin movimientos en el listado de archivos.
        """
        # El duplicado se mide dentro del tipo: un RUT puede tener el mismo día
        # un estado diario y un archivo de movimientos, pero no dos de estos.
        existente = self.repo.find_origen_movimientos(rut, fecha)
        if existente:
            raise ValueError(
                f"Ya existe un archivo de movimientos para el RUT {rut} del {fecha} "
                f"(origen {existente.id}). Elimínelo antes de volver a cargarlo."
            )

        try:
            filas = parse_movimientos_file(file_path)
        except Exception as e:
            raise ValueError(f"No se pudo leer el archivo de movimientos: {e}")

        if not filas:
            raise ValueError(
                "El archivo no contiene movimientos reconocibles. Verifique que "
                "las hojas tengan los encabezados esperados (Rit/Rol, Tribunal, "
                "Caratulado, Fecha Ingreso, Estado Causa, Institución)."
            )

        origen = EstadoDiarioOrigen(
            usuario_carga_id=usuario_id,
            tipo=EstadoDiarioOrigen.TIPO_MOVIMIENTOS,
            rut=rut,
            fecha=fecha,
            nombre_archivo=nombre_archivo or os.path.basename(file_path),
            fecha_carga=datetime.now(timezone.utc),
        )
        self.db.add(origen)
        self.db.flush()  # asigna origen.id sin cerrar la transacción

        cache_jurisdiccion: dict[str, Optional[int]] = {}
        por_materia: dict[str, int] = {}

        for fila in filas:
            mov = Movimiento(
                estado_diario_origen_id=origen.id,
                materia=fila.get("materia"),
                rol=fila.get("rol"),
                era=fila.get("era"),
                tribunal=fila.get("tribunal"),
                corte=fila.get("corte"),
                caratulado=fila.get("caratulado"),
                fecha_ingreso=fila.get("fecha_ingreso"),
                estado_causa=fila.get("estado_causa"),
                institucion=fila.get("institucion"),
                ubicacion=fila.get("ubicacion"),
                fecha_ubicacion=fila.get("fecha_ubicacion"),
            )

            # Solo la hoja "Corte Apelaciones" trae la columna Corte; es el
            # único dato que permite amarrar la fila a una jurisdicción.
            if mov.corte:
                if mov.corte not in cache_jurisdiccion:
                    jur = self.jurisdiccion_repo.find_by_nombre(mov.corte)
                    cache_jurisdiccion[mov.corte] = jur.id if jur else None
                mov.jurisdiccion_id = cache_jurisdiccion[mov.corte]

            self.db.add(mov)
            por_materia[mov.materia or "(sin materia)"] = (
                por_materia.get(mov.materia or "(sin materia)", 0) + 1
            )

        self.db.commit()
        logger.info(
            "Importados %d movimientos para origen %d (%s)",
            len(filas), origen.id, por_materia,
        )
        return {
            "origen_id": origen.id,
            "movimientos_importados": len(filas),
            "por_materia": por_materia,
        }
