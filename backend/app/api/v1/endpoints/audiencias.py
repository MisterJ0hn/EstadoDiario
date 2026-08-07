"""Endpoints del módulo Audiencias.

Consulta + carga + sincronización con Google Calendar. No hay acciones sobre
una audiencia (leído, pendiente, agenda): la fija el tribunal y el sistema solo
la informa.

El default del listado es "de hoy en adelante": el módulo se llama "Próximas
audiencias" y esa es la pregunta que responde. Para ver el histórico hay que
mandar `desde` explícitamente.

Sin filtro de visibilidad: dentro de un estudio todos ven todo.
asignada, todas.
"""

import logging
import os
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.config import UPLOAD_DIR
from app.core.deps import get_db_tenant, get_usuario_actual
from app.models.usuario import Usuario
from app.repositories.audiencia_repository import AudienciaRepository
from app.repositories.configuracion_correo_repository import ConfiguracionCorreoRepository
from app.schemas.audiencia import (
    AudienciaListResponse,
    AudienciaOrigenListResponse,
    AudienciaOrigenResponse,
    AudienciaResponse,
    AudienciaResumenResponse,
    AudienciaUploadResponse,
    ConteoMateriaAudiencia,
    SincronizarGoogleResponse,
)
from app.services.audiencia_calendar_service import AudienciaCalendarService
from app.services.audiencia_import_service import (
    AudienciaImportService,
    parse_nombre_archivo,
)
from app.services.estado_diario_service import EstadoDiarioService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audiencias", tags=["Audiencias"])


@router.get(
    "",
    response_model=AudienciaListResponse,
    summary="Listar audiencias (paginado y filtrado, próximas primero)",
)
def listar_audiencias(
    materia: str | None = Query(None, description="Nombre de la hoja: Familia, Laboral, Penal"),
    tipo_audiencia: str | None = Query(None),
    tribunal: str | None = Query(None, description="Coincidencia parcial"),
    busqueda: str | None = Query(None, description="Busca en carátula, RIT y RUC"),
    rut: str | None = Query(None),
    origen_id: int | None = Query(None),
    desde: date | None = Query(
        None, description="Fecha de audiencia mínima. Por defecto, hoy."
    ),
    hasta: date | None = Query(None, description="Fecha de audiencia máxima"),
    incluir_pasadas: bool = Query(
        False, description="Ignora el `desde` por defecto y muestra también el histórico"
    ),
    page: int | None = Query(None, ge=1),
    limit: int | None = Query(None, ge=1, le=500),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    # "Próximas" es el default del módulo; `incluir_pasadas` es la vía explícita
    # para ver el histórico sin tener que inventar una fecha de inicio.
    if desde is None and not incluir_pasadas:
        desde = date.today()

    repo = AudienciaRepository(db)
    items, total, current_page, total_pages = repo.find_filtered(
        materia=materia,
        tipo_audiencia=tipo_audiencia,
        tribunal=tribunal,
        busqueda=busqueda,
        rut=rut,
        origen_id=origen_id,
        desde=desde,
        hasta=hasta,
        page=page,
        limit=limit,
    )
    return AudienciaListResponse(
        total=total,
        page=current_page,
        total_pages=total_pages,
        audiencias=[AudienciaResponse.from_model(a) for a in items],
    )


@router.get(
    "/resumen",
    response_model=AudienciaResumenResponse,
    summary="Conteo por materia y tipos de audiencia disponibles",
)
def resumen(
    tipo_audiencia: str | None = Query(None),
    tribunal: str | None = Query(None),
    busqueda: str | None = Query(None),
    rut: str | None = Query(None),
    origen_id: int | None = Query(None),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    incluir_pasadas: bool = Query(False),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Alimenta las pestañas por materia y el combo de tipo de audiencia.

    Los conteos usan el MISMO recorte temporal que el listado; si no, la pestaña
    diría 40 y la tabla mostraría 8.
    """
    if desde is None and not incluir_pasadas:
        desde = date.today()

    repo = AudienciaRepository(db)
    conteos = repo.contar_por_materia(
        tipo_audiencia=tipo_audiencia,
        tribunal=tribunal,
        busqueda=busqueda,
        rut=rut,
        origen_id=origen_id,
        desde=desde,
        hasta=hasta,
    )
    return AudienciaResumenResponse(
        total=sum(c for _, c in conteos),
        por_materia=[ConteoMateriaAudiencia(materia=m, total=c) for m, c in conteos],
        tipos_audiencia=repo.listar_tipos_audiencia(),
    )


@router.get(
    "/calendario",
    response_model=AudienciaListResponse,
    summary="Audiencias de una ventana de fechas, para el calendario",
)
def calendario(
    desde: date = Query(..., description="Inicio de la ventana (YYYY-MM-DD)"),
    hasta: date = Query(..., description="Fin de la ventana (YYYY-MM-DD)"),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Rango obligatorio, a diferencia de /estado-diario/calendario.

    Los recordatorios vigentes son un conjunto acotado y se traen enteros; las
    audiencias se acumulan sin techo, así que el calendario pide solo el mes
    que está pintando.
    """
    repo = AudienciaRepository(db)
    items = repo.find_para_calendario(
        desde=desde,
        hasta=hasta,
    )
    return AudienciaListResponse(
        total=len(items),
        audiencias=[AudienciaResponse.from_model(a) for a in items],
    )


@router.get(
    "/archivos",
    response_model=AudienciaOrigenListResponse,
    summary="Listar archivos de audiencias cargados",
)
def listar_archivos(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    repo = AudienciaRepository(db)
    # Los archivos son del estudio y no se filtran; lo que se acota por
    # jurisdicción es su contenido, que es lo que cuenta `count_filtered`.
    items, total, current_page, total_pages = repo.find_origenes_paginados(
        page=page, per_page=per_page
    )

    # Un solo GROUP BY para toda la página en vez de un COUNT por archivo.
    # El contador dice cuántas audiencias apuntan HOY a ese archivo, que puede
    # ser menos de lo que traía el Excel: las que un archivo posterior volvió a
    # informar quedaron apuntando a ese otro.
    conteos = repo.contar_por_origen([o.id for o in items])

    return AudienciaOrigenListResponse(
        total=total,
        page=current_page,
        total_pages=total_pages,
        origenes=[
            AudienciaOrigenResponse(
                id=o.id,
                rut=o.rut,
                fecha=o.fecha,
                nombre_archivo=o.nombre_archivo,
                fecha_carga=o.fecha_carga,
                usuario_carga=o.usuario_carga.usuario if o.usuario_carga else None,
                total_audiencias=conteos.get(o.id, 0),
            )
            for o in items
        ],
    )


@router.post(
    "/upload",
    response_model=AudienciaUploadResponse,
    summary="Subir archivo XLS/XLSX de audiencias",
)
def upload_audiencias(
    file: UploadFile = File(...),
    rut: str | None = Form(default=None),
    fecha: str | None = Form(default=None),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """El archivo queda a nombre del usuario que lo sube: él es su dueño y nadie
    más (salvo el admin) verá esas audiencias."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".xls", ".xlsx", ".xlsm"):
        return AudienciaUploadResponse(
            exito=False, mensaje="Solo se permiten archivos XLS o XLSX"
        )

    rut = rut.strip() if rut else None
    fecha = fecha.strip() if fecha else None

    fecha_date: date | None = None
    if fecha:
        try:
            fecha_date = date.fromisoformat(fecha)
        except ValueError:
            fecha_date = None

    # Lo que no venga en el formulario se saca del nombre del archivo, que se
    # lee de forma tolerante (el PJUD ya le cambió el formato una vez). Ni el
    # RUT ni la fecha son obligatorios acá: el RUT puede quedar vacío y la fecha
    # la deduce el servicio del contenido del archivo (la audiencia más
    # temprana). Se prefiere el respaldo de la casilla del usuario antes que
    # dejar el RUT nulo.
    rut_archivo, desde_archivo, _hasta = parse_nombre_archivo(file.filename or "")
    config = ConfiguracionCorreoRepository(db).get_or_create(current_user.id)

    rut_final = rut or rut_archivo or (config.rut.strip() if config.rut else None)
    fecha_final = fecha_date or desde_archivo

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    with open(filepath, "wb") as f:
        f.write(file.file.read())

    try:
        service = AudienciaImportService(db)
        resultado = service.import_file(
            filepath, rut_final, fecha_final, current_user.id, file.filename
        )
        # La fecha efectiva la devuelve el servicio: puede haberla deducido del
        # contenido si no venía ni en el formulario ni en el nombre.
        fecha_efectiva = resultado.pop("fecha", None) or fecha_final
        return AudienciaUploadResponse(
            exito=True,
            rut=rut_final,
            fecha=str(fecha_efectiva) if fecha_efectiva else None,
            **resultado,
        )
    except Exception as e:
        # Sin traceback en el log, el mensaje que ve el usuario no alcanza para
        # ubicar la causa (encoding, hoja inesperada, etc.).
        logger.exception("Fallo al importar audiencias %s", file.filename)
        db.rollback()
        return AudienciaUploadResponse(
            exito=False, mensaje=f"Error al procesar el archivo: {e}"
        )


@router.post(
    "/sincronizar-google",
    response_model=SincronizarGoogleResponse,
    summary="Publicar en Google Calendar las audiencias futuras pendientes",
)
def sincronizar_google(
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Reintento manual de la sincronización que ya corre sola al importar.

    Sirve para el caso típico: el usuario conectó su Google DESPUÉS de que le
    llegaran las audiencias por correo. Siempre sobre SU calendario, incluso si
    es admin: el admin ve las audiencias de todos, pero no publica las ajenas en
    su agenda personal.
    """
    resultado = AudienciaCalendarService(db).sincronizar_pendientes(current_user.id)

    if resultado["sincronizadas"] == 0 and resultado["pendientes"] > 0:
        return SincronizarGoogleResponse(
            exito=False,
            mensaje="No se pudo publicar ninguna audiencia. Verifique que su cuenta "
                    "de Google esté conectada en su perfil.",
            **resultado,
        )
    return SincronizarGoogleResponse(
        mensaje=f"{resultado['sincronizadas']} audiencias publicadas en Google Calendar",
        **resultado,
    )
