import logging
import os
import shutil
from datetime import datetime, timezone, date
from typing import Optional

import xlrd
import openpyxl
from sqlalchemy.orm import Session

from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.repositories.estado_diario_repository import EstadoDiarioRepository
from app.repositories.estado_diario_origen_repository import EstadoDiarioOrigenRepository
from app.repositories.jurisdiccion_repository import JurisdiccionRepository
from app.models.jurisdiccion import Jurisdiccion

logger = logging.getLogger(__name__)

# Mapeo de nombres de columna del Excel a campos internos
# Cada hoja puede tener columnas distintas; se busca por nombre de header
HEADER_ALIASES = {
    "rol": "rol",
    "n° ingreso": "rol",
    "nø ingreso": "rol",
    "n\u00b0 ingreso": "rol",
    "rol interno": "rol",
    "rit": "rol",
    "ruc": "rol_unico",
    "rol unico": "rol_unico",
    "rol único": "rol_unico",
    "rol \u00fanico": "rol_unico",
    "fecha ingreso": "fecha_ingreso",
    "caratulado": "caratulado",
    "tribunal": "tribunal",
    "tipo causa": "tipo_causa",
    "tipo recurso": "tipo_causa",
    "ubicacion": "ubicacion",
    "ubicación": "ubicacion",
    "fecha ubicacion": "fecha_ubicacion",
    "fecha ubicación": "fecha_ubicacion",
    "estado": "estado",
    "corte": "corte",
}


class ImportService:
    # El estado diario es el reporte de UN día y esa fecha no está dentro del
    # archivo: si el nombre no la trae, no hay de dónde sacarla.
    deduce_fecha_del_contenido = False
    # Su control de duplicados es (rut, fecha): sin RUT dejaría entrar el mismo
    # archivo cuantas veces llegue.
    requiere_rut = True

    def __init__(self, db: Session):
        self.db = db
        self.origen_repo = EstadoDiarioOrigenRepository(db)
        self.ed_repo = EstadoDiarioRepository(db)
        self.jurisdiccion_repo = JurisdiccionRepository(db)

    def import_file(
        self,
        file_path: str,
        rut: str,
        fecha: date,
        usuario_id: Optional[int] = None,
        nombre_archivo: Optional[str] = None,
    ) -> dict:
        # Un mismo RUT solo puede tener un estado diario por fecha. Sin esta
        # validación, reimportar el archivo duplica todos los movimientos, y
        # con la ingesta automática por correo eso ocurriría sin que nadie lo
        # note. Para recargar, primero hay que borrar el origen existente.
        # La unicidad es por dueño: dos abogados pueden recibir legítimamente
        # el estado diario del mismo RUT el mismo día en sus casillas.
        existente = self.origen_repo.find_by_rut_fecha(
            rut, fecha, usuario_id, EstadoDiarioOrigen.TIPO_ESTADO_DIARIO
        )
        if existente:
            raise ValueError(
                f"Ya existe un estado diario para el RUT {rut} del {fecha} "
                f"(origen {existente.id}). Elimínelo antes de volver a cargarlo."
            )

        # Detectar formato real por header bytes (la extensión puede mentir)
        file_path = self._ensure_correct_extension(file_path)

        # Se parsea ANTES de crear el origen: si el archivo es ilegible no debe
        # quedar una fila huérfana sin movimientos en el listado.
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".xlsx":
            try:
                rows = self._read_xlsx(file_path)
            except Exception as e:
                raise ValueError(f"No se pudo leer el archivo XLSX: {e}")
        else:
            try:
                rows = self._read_xls(file_path)
            except Exception as e:
                raise ValueError(f"No se pudo leer el archivo XLS: {e}")

        if not rows:
            raise ValueError(
                "El archivo no contiene movimientos reconocibles. "
                "Verifique que las columnas tengan los encabezados esperados."
            )

        origen = EstadoDiarioOrigen(
            usuario_carga_id=usuario_id,
            tipo=EstadoDiarioOrigen.TIPO_ESTADO_DIARIO,
            rut=rut,
            fecha=fecha,
            nombre_archivo=nombre_archivo or os.path.basename(file_path),
            fecha_carga=datetime.now(timezone.utc),
        )
        self.db.add(origen)
        self.db.flush()  # asigna origen.id sin cerrar la transacción

        count = 0
        for row in rows:
            ed = EstadoDiario(
                estado_diario_origen_id=origen.id,
                rol=row.get("rol"),
                rol_unico=row.get("rol_unico"),
                fecha_ingreso=row.get("fecha_ingreso"),
                caratulado=row.get("caratulado"),
                tribunal=row.get("tribunal"),
                tipo_causa=row.get("tipo_causa"),
                ubicacion=row.get("ubicacion"),
                fecha_ubicacion=row.get("fecha_ubicacion"),
                estado=row.get("estado"),
                corte=row.get("corte"),
            )

            # Try to match jurisdiccion from corte
            if ed.corte:
                jur = self.jurisdiccion_repo.find_by_nombre(ed.corte)
                if jur:
                    ed.jurisdiccion_id = jur.id

            self.db.add(ed)
            count += 1

        self.db.commit()
        logger.info("Importados %d movimientos para origen %d", count, origen.id)
        return {"origen_id": origen.id, "movimientos_importados": count}

    @staticmethod
    def _ensure_correct_extension(file_path: str) -> str:
        """Si el archivo tiene extensión .xls pero es realmente XLSX (ZIP),
        lo renombra a .xlsx para que openpyxl lo acepte."""
        ext = os.path.splitext(file_path)[1].lower()
        with open(file_path, "rb") as f:
            header = f.read(4)

        is_zip = header[:2] == b"PK"
        is_ole2 = header[:4] == b"\xd0\xcf\x11\xe0"

        if is_zip and ext != ".xlsx":
            new_path = file_path.rsplit(".", 1)[0] + ".xlsx"
            shutil.move(file_path, new_path)
            return new_path
        if is_ole2 and ext != ".xls":
            new_path = file_path.rsplit(".", 1)[0] + ".xls"
            shutil.move(file_path, new_path)
            return new_path
        return file_path

    def _read_xls(self, file_path: str) -> list[dict]:
        wb = xlrd.open_workbook(file_path)
        rows = []
        for sheet_idx in range(wb.nsheets):
            ws = wb.sheet_by_index(sheet_idx)
            if ws.nrows < 2:
                continue

            # Build column mapping from header
            col_map = {}
            for col_idx in range(ws.ncols):
                header = str(ws.cell_value(0, col_idx)).strip().lower()
                for orig, field in HEADER_ALIASES.items():
                    if header == orig:
                        col_map[col_idx] = field
                        break

            if not col_map:
                continue

            for row_idx in range(1, ws.nrows):
                row_data = {}
                for col_idx, field in col_map.items():
                    value = ws.cell_value(row_idx, col_idx)
                    if field in ("fecha_ingreso", "fecha_ubicacion"):
                        value = self._parse_date_xls(value, wb.datemode)
                    else:
                        value = str(value).strip() if value else None
                    row_data[field] = value

                if not row_data.get("corte"):
                    row_data["corte"] = ws.name

                if any(v for k, v in row_data.items() if k != "corte"):
                    rows.append(row_data)
        return rows

    def _read_xlsx(self, file_path: str) -> list[dict]:
        wb = openpyxl.load_workbook(file_path)
        rows = []
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            if ws.max_row is None or ws.max_row < 2:
                continue

            # Build column mapping from header row
            col_map = self._build_col_map(ws)
            if not col_map:
                continue

            for row_idx in range(2, ws.max_row + 1):
                row_data = {}
                for col_idx, field in col_map.items():
                    value = ws.cell(row_idx, col_idx).value
                    if field in ("fecha_ingreso", "fecha_ubicacion"):
                        value = self._parse_date_xlsx(value)
                    else:
                        value = str(value).strip() if value else None
                    row_data[field] = value

                # Use sheet name as corte if not already set
                if not row_data.get("corte"):
                    row_data["corte"] = sheet_name

                if any(v for k, v in row_data.items() if k != "corte"):
                    rows.append(row_data)
        wb.close()
        return rows

    @staticmethod
    def _build_col_map(ws) -> dict[int, str]:
        """Map 1-based column indices to field names using header aliases."""
        col_map = {}
        for col_idx in range(1, (ws.max_column or 0) + 1):
            header = ws.cell(1, col_idx).value
            if not header:
                continue
            normalized = header.strip().lower()
            # Remove special chars for matching
            for orig, field in HEADER_ALIASES.items():
                if normalized == orig or normalized.replace("°", "").replace("º", "") == orig.replace("°", "").replace("º", ""):
                    col_map[col_idx] = field
                    break
        return col_map

    def _parse_date_xls(self, value, datemode) -> Optional[date]:
        if not value:
            return None
        try:
            if isinstance(value, float):
                dt = xlrd.xldate_as_datetime(value, datemode)
                return dt.date()
            return datetime.strptime(str(value).strip(), "%d/%m/%Y").date()
        except Exception:
            try:
                return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
            except Exception:
                return None

    def _parse_date_xlsx(self, value) -> Optional[date]:
        if not value:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        try:
            return datetime.strptime(str(value).strip(), "%d/%m/%Y").date()
        except Exception:
            try:
                return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
            except Exception:
                return None
