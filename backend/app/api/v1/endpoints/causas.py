"""Cartera de causas del estudio.

Tercer reporte del PJUD que entra al sistema, y el que responde otra pregunta:
estado diario dice qué se movió hoy, movimientos dice cómo va cada tramitación,
y esto dice **qué causas tiene el estudio**, se hayan movido o no.

Sin filtro de visibilidad: dentro de un estudio todos ven todo.
"""

import logging
import mimetypes
import os
import time
import uuid
from datetime import date, timedelta, timezone
from types import SimpleNamespace
from urllib.parse import unquote, urlsplit

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import UPLOAD_DIR, settings
from app.core.database import get_db_maestra
from app.core.credenciales_pjud import (
    Sellador,
    credenciales_del_dueno,
    sellador_solicitado,
)
from app.core.filtro_roles import DESC_ROLES, DESC_ROLES_CORTE, DESC_ROLES_ORIGEN, parse_roles, parse_roles_corte, parse_roles_origen
from app.core.deps import TenantContexto, get_db_tenant, get_tenant_actual, get_usuario_actual
from app.models.causa_corte import CausaCorte
from app.models.maestra.cliente import Cliente
from app.models.usuario import Usuario
from app.repositories.causa_corte_repository import CausaCorteRepository
from app.repositories.causa_repository import FINALIZADAS, SIN_MATERIA, VIGENTES, CausaRepository
from app.repositories.pjud_copia_repository import PjudCopiaRepository, clave_de
from app.repositories.pjud_llamado_repository import PjudLlamadoRepository
from app.repositories.pjud_sincronizacion_repository import (
    ERROR as SINC_ERROR,
    SINCRONIZANDO as SINC_SINCRONIZANDO,
    PjudSincronizacionRepository,
)
from app.schemas.causa import (
    CargarCausasResponse,
    CausaCorteListResponse,
    CausaCorteResponse,
    CausaListResponse,
    CausaResponse,
    CausaResumenResponse,
    ConteoMateria,
    CrearCausaRequest,
    CrearCausaResponse,
)
from app.schemas.pjud import (
    PjudApelacionesMovimientosResponse,
    PjudCallbackRequest,
    PjudCallbackResponse,
    PjudCobranzaMovimientosResponse,
    PjudDisponibleResponse,
    PjudEstadoSincronizacionResponse,
    PjudFamiliaMovimientosResponse,
    PjudLaboralMovimientosResponse,
    PjudPenalMovimientosResponse,
    PjudMovimientosResponse,
    PjudPorRolResponse,
    PjudSincronizarResponse,
)
from app.services.causa_api_service import CausaApiService, materia_canonica
from app.services.causa_import_service import CausaImportService, parse_nombre_archivo
from app.services.pjud_service import (
    _MENSAJE_ERROR_SYNC,
    _MENSAJE_SINCRONIZANDO,
    PjudApiError,
    PjudNoEncontrado,
    PjudService,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/causas", tags=["Causas"])


def _vigencia(valor: str | None) -> str | None:
    """Normaliza el parámetro `vigencia` de la cartera.

    Cualquier cosa que no sea uno de los dos valores conocidos se trata como
    "sin filtro" en vez de rechazarse: es un interruptor de pantalla, y un 422
    por un query param mal escrito dejaría el listado en blanco en vez de
    mostrar de más.
    """
    normalizado = (valor or "").strip().lower()
    return normalizado if normalizado in (VIGENTES, FINALIZADAS) else None


# ── Carga ─────────────────────────────────────────────────


@router.post(
    "",
    response_model=CrearCausaResponse,
    summary="Dar de alta una causa (solo sistemas externos con API key)",
)
def crear_causa(
    body: CrearCausaRequest,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Crea UNA causa en Mis Causas **sin abogado asignado** (`rut` null).

    El abogado se asigna solo, cuando llega un estado diario que trae la causa
    (ver `CarteraSyncService`). No se puede indicar acá. Si el `rol + tribunal`
    ya está en Mis Causas se devuelve esa causa sin tocarla (`creada: false`).
    """
    if not current_user.es_integracion:
        raise HTTPException(
            status_code=403,
            detail="El alta individual de causas es solo para sistemas externos (API key)",
        )
    materia = materia_canonica(body.materia)
    if materia is None:
        raise HTTPException(
            status_code=422,
            detail="Materia inválida: use Civil, Familia, Laboral, Cobranza o Penal",
        )
    causa, creada = CausaApiService(db).crear(
        materia=materia, usuario_id=current_user.id,
        **body.model_dump(exclude={"materia"}),
    )
    return CrearCausaResponse(creada=creada, causa=CausaResponse.from_model(causa))


@router.post(
    "/upload",
    response_model=CargarCausasResponse,
    summary="Subir el archivo XLS/XLSX de causas",
)
def upload_causas(
    file: UploadFile = File(...),
    rut: str | None = Form(default=None),
    fecha: str | None = Form(default=None),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Importa la cartera de causas.

    **La fecha no está en el archivo** (a diferencia de movimientos y
    audiencias, que la traen en el nombre): este reporte es una foto de la
    cartera al momento de emitirlo. Si no se indica, se usa hoy — que es lo que
    corresponde para quien acaba de descargarlo del PJUD.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".xls", ".xlsx", ".xlsm"):
        return CargarCausasResponse(
            exito=False, mensaje="Solo se permiten archivos XLS o XLSX",
            origen_id=0, causas_importadas=0, cortes_importados=0,
        )

    rut = rut.strip() if rut else None
    fecha = fecha.strip() if fecha else None

    fecha_date: date | None = None
    if fecha:
        try:
            fecha_date = date.fromisoformat(fecha)
        except ValueError:
            fecha_date = None

    # El nombre del archivo trae el RUT (Causas_16952077-1.xlsx) pero no la
    # fecha.
    rut_archivo, _ = parse_nombre_archivo(file.filename or "")
    rut_final = rut or rut_archivo
    fecha_final = fecha_date or date.today()

    if not rut_final:
        return CargarCausasResponse(
            exito=False,
            mensaje="No se pudo determinar el RUT. Indíquelo manualmente o use "
                    "el formato: Causas_RUT.xlsx",
            origen_id=0, causas_importadas=0, cortes_importados=0,
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    with open(filepath, "wb") as f:
        f.write(file.file.read())

    try:
        resultado = CausaImportService(db).import_file(
            filepath, rut_final, fecha_final, current_user.id, file.filename
        )
        return CargarCausasResponse(
            exito=True,
            mensaje=(
                f"{resultado['causas_importadas']} causas y "
                f"{resultado['cortes_importados']} de corte importadas"
            ),
            **resultado,
        )
    except Exception as e:
        # Sin traceback en el log, el mensaje que ve el usuario no alcanza para
        # ubicar la causa (encoding, hoja inesperada, etc.).
        logger.exception("Fallo al importar causas %s", file.filename)
        db.rollback()
        return CargarCausasResponse(
            exito=False, mensaje=f"Error al procesar el archivo: {e}",
            origen_id=0, causas_importadas=0, cortes_importados=0,
        )


# ── Causas de corte (submenú Corte) ───────────────────────
# OJO: va ANTES del listado por materia solo por orden de lectura; lo que sí
# importa es que ninguna ruta con parámetro (`/{algo}`) quede declarada antes
# que ésta, porque FastAPI resuelve por orden y `/cortes` caería ahí.


@router.get(
    "/cortes",
    response_model=CausaCorteListResponse,
    summary="Causas de Corte Suprema y Corte de Apelaciones",
)
def listar_cortes(
    tipo: str | None = Query(None, description="suprema o apelaciones"),
    busqueda: str | None = Query(None, description="Carátula o rol"),
    corte: str | None = Query(None, description="Nombre de la corte"),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    vigencia: str | None = Query(
        VIGENTES, description="vigentes | finalizadas | vacío para todas"
    ),
    roles: str | None = Query(None, description=DESC_ROLES_CORTE),
    roles_origen: str | None = Query(None, description=DESC_ROLES_ORIGEN),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db_tenant),
    tenant: TenantContexto = Depends(get_tenant_actual),
    db_maestra: Session = Depends(get_db_maestra),
    current_user: Usuario = Depends(get_usuario_actual),
):
    repo = CausaCorteRepository(db)
    items, total, pagina, total_pages = repo.find_filtered(
        tipo=tipo, busqueda=busqueda, corte=corte,
        fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        vigencia=_vigencia(vigencia), roles=parse_roles_corte(roles), roles_origen=parse_roles_origen(roles_origen),
        page=page, limit=limit,
    )
    estados_pjud = {}
    if settings.pjud_api_activo:
        ids_apelaciones = [c.id for c in items if c.tipo == "apelaciones"]
        llamados = PjudLlamadoRepository(db_maestra).ultimos_por_causa(
            cliente_id=tenant.cliente_id, causa_ids=ids_apelaciones, apelaciones=True,
        )
        sincronizaciones = _sincronizaciones_pjud(
            db_maestra, tenant.cliente_id, ids_apelaciones, apelaciones=True
        )
        for causa_id in ids_apelaciones:
            estado = SimpleNamespace(pjud_estado=None, pjud_fecha_sincronizacion=None)
            _aplicar_estado_pjud(estado, llamados.get(causa_id), sincronizaciones.get(causa_id))
            estados_pjud[causa_id] = estado
    return CausaCorteListResponse(
        total=total,
        page=pagina,
        total_pages=total_pages,
        cortes=[
            CausaCorteResponse(
                id=c.id,
                tipo=c.tipo,
                rol=c.rol,
                era=c.era,
                tipo_libro=c.tipo_libro,
                origen_rol=c.origen_rol,
                origen_tribunal=c.origen_tribunal,
                origen_causa_id=c.origen_causa_id,
                corte=c.corte,
                fecha_ingreso=c.fecha_ingreso,
                ubicacion=c.ubicacion,
                fecha_ubicacion=c.fecha_ubicacion,
                caratulado=c.caratulado,
                estado_procesal=c.estado_procesal,
                institucion=c.institucion,
                fecha_archivo=c.estado_diario_origen.fecha if c.estado_diario_origen else None,
                pjud_estado=estados_pjud[c.id].pjud_estado if c.id in estados_pjud else None,
                pjud_fecha_sincronizacion=(
                    estados_pjud[c.id].pjud_fecha_sincronizacion if c.id in estados_pjud else None
                ),
            )
            for c in items
        ],
        cortes_disponibles=repo.listar_cortes(),
        conteo_por_tipo=repo.contar_por_tipo_filtrado(
            busqueda=busqueda, corte=corte,
            fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
            vigencia=_vigencia(vigencia), roles=parse_roles_corte(roles),
            roles_origen=parse_roles_origen(roles_origen),
        ),
    )


# ── Listado por materia (submenú Materia) ─────────────────


@router.get(
    "/resumen",
    response_model=CausaResumenResponse,
    summary="Conteos por materia y estados disponibles",
)
def resumen(
    estado_causa: str | None = Query(None),
    tribunal: str | None = Query(None),
    busqueda: str | None = Query(None),
    origen_id: int | None = Query(None),
    vigencia: str | None = Query(
        VIGENTES, description="vigentes | finalizadas | vacío para todas"
    ),
    roles: str | None = Query(None, description=DESC_ROLES),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Alimenta las pestañas del listado. Respeta los filtros activos menos el
    de materia, que es justamente lo que las pestañas dejan elegir."""
    repo = CausaRepository(db)
    conteos = repo.contar_por_materia(
        estado_causa=estado_causa, tribunal=tribunal,
        busqueda=busqueda, origen_id=origen_id, vigencia=_vigencia(vigencia),
        roles=parse_roles(roles),
    )
    return CausaResumenResponse(
        total=sum(t for _, t in conteos),
        por_materia=[ConteoMateria(materia=m, total=t) for m, t in conteos],
        estados_causa=repo.listar_estados_causa(origen_id),
    )


@router.get(
    "",
    response_model=CausaListResponse,
    summary="Listar la cartera de causas",
)
def listar(
    materia: str | None = Query(
        None,
        description=f"Nombre exacto, '{SIN_MATERIA}' para causas sin materia, o vacío para todas",
    ),
    estado_causa: str | None = Query(None),
    tribunal: str | None = Query(None),
    busqueda: str | None = Query(None, description="Carátula, rol o RUC"),
    origen_id: int | None = Query(None),
    vigencia: str | None = Query(
        VIGENTES, description="vigentes | finalizadas | vacío para todas"
    ),
    sin_actividad_meses: int | None = Query(
        None, ge=1, le=120,
        description="Solo las que no aparecen en ningún reporte hace más de N meses",
    ),
    con_audiencia_dias: int | None = Query(
        None, ge=0, le=365,
        description="Solo las que tienen audiencia dentro de los próximos N días",
    ),
    orden: str | None = Query(
        None, description="actividad | audiencia. Por defecto, fecha de ingreso.",
    ),
    roles: str | None = Query(None, description=DESC_ROLES),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db_tenant),
    db_maestra: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
    current_user: Usuario = Depends(get_usuario_actual),
    sellador: Sellador | None = Depends(sellador_solicitado),
):
    """Sin `origen_id`, devuelve **solo el último archivo de causas**: el
    reporte trae la cartera completa cada vez, y sumar todos los que se
    cargaron mostraría la misma causa tantas veces como se haya importado."""
    items, total, pagina, total_pages = CausaRepository(db).find_filtered(
        materia=materia, estado_causa=estado_causa, tribunal=tribunal,
        busqueda=busqueda, origen_id=origen_id, vigencia=_vigencia(vigencia),
        sin_actividad_meses=sin_actividad_meses,
        con_audiencia_hasta=(
            date.today() + timedelta(days=con_audiencia_dias)
            if con_audiencia_dias is not None
            else None
        ),
        orden=orden, roles=parse_roles(roles),
        page=page, limit=limit,
    )
    causas_resp = [CausaResponse.from_model(c) for c in items]

    # Último estado conocido de "Detalle PJUD" por causa (del log de llamados,
    # NO en vivo al proveedor): pinta el icono del botón sin el costo de
    # golpear a api-pjud una vez por fila. Solo aplica a Civil, Familia,
    # Laboral, Cobranza y Penal, que son las materias con ese botón.
    if settings.pjud_api_activo:
        pjud_ids = [
            r.id for r, c in zip(causas_resp, items)
            if (c.materia or "").strip().lower() in ("civil", "familia", "laboral", "cobranza", "penal")
        ]
        ultimos_pjud = PjudLlamadoRepository(db_maestra).ultimos_por_causa(
            cliente_id=tenant.cliente_id, causa_ids=pjud_ids,
        )
        sincronizaciones = _sincronizaciones_pjud(
            db_maestra, tenant.cliente_id, pjud_ids
        )
        for r in causas_resp:
            _aplicar_estado_pjud(r, ultimos_pjud.get(r.id), sincronizaciones.get(r.id))

    credenciales = api_pjud = pjud_habilitado = None
    if sellador is not None:
        entrega = sellador.entregar(db, [r.rut for r in causas_resp])
        for r, ref in zip(causas_resp, entrega.refs):
            r.credencial_ref = ref
        credenciales = entrega.credenciales_pjud
        api_pjud = entrega.api_pjud
        pjud_habilitado = entrega.pjud_habilitado

    return CausaListResponse(
        total=total,
        page=pagina,
        total_pages=total_pages,
        causas=causas_resp,
        credenciales_pjud=credenciales,
        api_pjud=api_pjud,
        pjud_habilitado=pjud_habilitado,
    )


# ── Detalle en vivo desde el PJUD (solo Civil) ────────────


def _pjud_habilitado(db_maestra: Session, tenant: TenantContexto) -> bool:
    """Si la consola de administración le encendió el Detalle PJUD al cliente."""
    cliente = db_maestra.get(Cliente, tenant.cliente_id)
    return bool(cliente and cliente.pjud_habilitado)


def requerir_pjud_habilitado(
    db_maestra: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
) -> None:
    """El botón se esconde en la pantalla, pero eso no es una barrera: sin esto
    bastaría llamar al endpoint a mano para consultar (y gastar) el PJUD."""
    if not _pjud_habilitado(db_maestra, tenant):
        raise HTTPException(
            status_code=403,
            detail="La consulta al PJUD no está habilitada para su estudio",
        )


@router.get(
    "/pjud/disponible",
    response_model=PjudDisponibleResponse,
    summary="Si la consulta de detalle PJUD está configurada",
)
def pjud_disponible(
    db_maestra: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """El frontend la consulta una vez para decidir si muestra el botón
    'Detalle PJUD': sin credenciales configuradas, no tiene sentido ofrecerlo
    y que cada clic termine en un error. Tampoco si la plataforma no se lo
    habilitó al estudio (ver `Cliente.pjud_habilitado`)."""
    return PjudDisponibleResponse(
        disponible=settings.pjud_api_activo and _pjud_habilitado(db_maestra, tenant)
    )


@router.get(
    "/pjud/por-rol",
    response_model=PjudPorRolResponse,
    summary="Resuelve la Causa Civil o de Familia de la cartera por rol y tribunal",
)
def pjud_por_rol(
    rol: str = Query(...),
    tribunal: str = Query(...),
    db: Session = Depends(get_db_tenant),
    db_maestra: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Para ofrecer el botón "Detalle PJUD" desde pantallas que muestran una
    causa por su rol/tribunal pero no conocen su id en la tabla `Causa`
    (Estado Diario, Movimientos): resuelve la Causa Civil o de Familia de la
    cartera vigente que calza, con su `pjud_estado` ya resuelto (mismo icono
    que en Mis Causas). `causa: null` si no calza ninguna o no es Civil ni de
    Familia: ahí la pantalla que llama simplemente no muestra el botón."""
    if not _pjud_habilitado(db_maestra, tenant):
        return PjudPorRolResponse(causa=None)

    causa = CausaRepository(db).find_pjud_por_rol_tribunal(rol, tribunal)
    if not causa:
        return PjudPorRolResponse(causa=None)

    respuesta = CausaResponse.from_model(causa)
    if settings.pjud_api_activo:
        ultimos_pjud = PjudLlamadoRepository(db_maestra).ultimos_por_causa(
            cliente_id=tenant.cliente_id, causa_ids=[causa.id],
        )
        _aplicar_estado_pjud(
            respuesta,
            ultimos_pjud.get(causa.id),
            _sincronizaciones_pjud(db_maestra, tenant.cliente_id, [causa.id]).get(causa.id),
        )
    return PjudPorRolResponse(causa=respuesta)


@router.get(
    "/pjud/documento",
    dependencies=[Depends(requerir_pjud_habilitado)],
    summary="Reenvía un documento (PDF/DOC/DOCX) del PJUD para abrirlo desde el navegador",
)
def pjud_documento(
    url: str = Query(..., description="URL del documento tal como vino en el detalle PJUD"),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """El detalle PJUD entrega los documentos como URLs del proveedor
    (`http://api-pjud.codifica.cl/public/…`): van por `http`, se sirven como
    adjunto y sin CORS, así que enlazadas directas el navegador las descarga o
    las bloquea. Esto las baja del proveedor y las reenvía por nuestra propia
    respuesta `https`, inline, para que el visor del navegador (o un iframe
    del modal) las muestre sin descargarlas.

    En Laboral (`movimiento`) el documento puede venir como `.pdf`, `.doc` o
    `.docx` en vez de solo PDF (Civil/Familia hasta ahora siempre traían PDF);
    el tipo se identifica por la extensión de la URL, no se asume un formato
    fijo. Para `.doc`/`.docx` no hay visor nativo del navegador, así que
    normalmente el navegador los descarga igual pese al `inline` — es
    comportamiento esperado, no un error.

    La descarga del proveedor es servidor-a-servidor; el `url` se valida contra
    `PJUD_API_BASE_URL` en `PjudService.abrir_documento` (no es un proxy
    abierto)."""
    return responder_documento_pjud(url)


def responder_documento_pjud(url: str) -> StreamingResponse:
    """Baja el documento del proveedor y lo reenvía (ver `pjud_documento`). Lo usa
    también el espejo de api-pjud para sistemas externos."""
    try:
        upstream = PjudService().abrir_documento(url)
    except PjudNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado en el PJUD")
    except PjudApiError as e:
        logger.warning("PJUD documento: %s (url=%s)", e, url)
        raise HTTPException(status_code=502, detail=str(e))

    nombre_archivo = os.path.basename(unquote(urlsplit(url).path)) or "documento"
    media_type, _ = mimetypes.guess_type(nombre_archivo)
    media_type = media_type or "application/octet-stream"

    def _emitir():
        try:
            yield from upstream.iter_content(chunk_size=64 * 1024)
        finally:
            upstream.close()

    # Sin Content-Length propio: `iter_content` puede entregar bytes ya
    # descomprimidos y el largo del proveedor dejaría de cuadrar. Se manda
    # chunked, que es lo que el visor del navegador espera igual.
    return StreamingResponse(
        _emitir(),
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{nombre_archivo}"',
            "Cache-Control": "private, max-age=300",
        },
    )


@router.get(
    "/{causa_id}/pjud/movimientos",
    dependencies=[Depends(requerir_pjud_habilitado)],
    response_model=PjudMovimientosResponse,
    summary="Detalle de una causa Civil consultado en vivo al PJUD",
)
def pjud_movimientos(
    causa_id: int,
    response: Response,
    forzar: bool = Query(False, description="Pide al PJUD que sincronice antes de consultar"),
    cuaderno: int | None = Query(None, description="Cuaderno a traer en Historia; por defecto el primero"),
    db: Session = Depends(get_db_tenant),
    tenant: TenantContexto = Depends(get_tenant_actual),
    db_maestra: Session = Depends(get_db_maestra),
    current_user: Usuario = Depends(get_usuario_actual),
):
    causa = CausaRepository(db).find_by_id(causa_id)
    if not causa:
        raise HTTPException(status_code=404, detail="Causa no encontrada")

    credenciales_dueno = credenciales_del_dueno(db, causa)

    inicio = time.monotonic()
    resultado_log = "error"
    http_status = 502
    mensaje_log: str | None = None
    diagnostico_log: str | None = None
    try:
        resultado = _detalle_pjud(
            db_maestra, tenant, db=db, causa_id=causa_id, materia="Civil",
            rol=causa.rol, tribunal=causa.tribunal, forzar=forzar,
            consultar=lambda s: s.obtener_detalle(
                causa,
                forzar_sincronizacion=forzar,
                cuaderno_id=cuaderno,
                credenciales_dueno=credenciales_dueno,
            ),
        )
        estado = resultado.get("estado")
        diagnostico_log = resultado.pop("diagnostico", None)
        # El scrape del proveedor es asíncrono: 202 mientras no esté listo, para
        # que el frontend distinga "espera y reintenta" de "listo".
        if estado == "sincronizando":
            response.status_code = http_status = 202
        elif estado in ("sin_credenciales", "error"):
            # No son errores HTTP: falta la clave, o el scrape del proveedor
            # falló. 200 con el estado (y `detalle_estado`) en el cuerpo — el
            # modal decide qué mostrar (ir a Mi Perfil / alerta roja).
            http_status = 200
        else:
            http_status = 200
        resultado_log = estado or "listo"
        mensaje_log = resultado.get("mensaje")
        return PjudMovimientosResponse(**resultado)
    except PjudApiError as e:
        mensaje_log = str(e)
        diagnostico_log = e.diagnostico
        raise HTTPException(status_code=502, detail=mensaje_log)
    finally:
        _registrar_llamado_pjud(
            db_maestra,
            tenant=tenant,
            causa_id=causa_id,
            rol=causa.rol,
            tribunal=causa.tribunal,
            materia="Civil",
            forzar=forzar,
            resultado=resultado_log,
            http_status=http_status,
            mensaje=mensaje_log,
            diagnostico=diagnostico_log,
            duracion_ms=int((time.monotonic() - inicio) * 1000),
        )


@router.get(
    "/{causa_id}/pjud/familia",
    dependencies=[Depends(requerir_pjud_habilitado)],
    response_model=PjudFamiliaMovimientosResponse,
    summary="Detalle de una causa de Familia consultado en vivo al PJUD",
)
def pjud_familia(
    causa_id: int,
    response: Response,
    forzar: bool = Query(False, description="Pide al PJUD que sincronice antes de consultar"),
    db: Session = Depends(get_db_tenant),
    tenant: TenantContexto = Depends(get_tenant_actual),
    db_maestra: Session = Depends(get_db_maestra),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Igual que `/pjud/movimientos` pero para causas de materia Familia: el
    flujo de sincronización asíncrona es el mismo, cambia la forma de la
    respuesta (ver `PjudFamiliaMovimientosResponse`). Familia no tiene
    cuadernos, así que no hay parámetro `cuaderno`."""
    causa = CausaRepository(db).find_by_id(causa_id)
    if not causa:
        raise HTTPException(status_code=404, detail="Causa no encontrada")

    credenciales_dueno = credenciales_del_dueno(db, causa)

    inicio = time.monotonic()
    resultado_log = "error"
    http_status = 502
    mensaje_log: str | None = None
    diagnostico_log: str | None = None
    try:
        resultado = _detalle_pjud(
            db_maestra, tenant, db=db, causa_id=causa_id, materia="Familia",
            rol=causa.rol, tribunal=causa.tribunal, forzar=forzar,
            consultar=lambda s: s.obtener_detalle_familia(
                causa,
                forzar_sincronizacion=forzar,
                credenciales_dueno=credenciales_dueno,
            ),
        )
        estado = resultado.get("estado")
        diagnostico_log = resultado.pop("diagnostico", None)
        if estado == "sincronizando":
            response.status_code = http_status = 202
        else:
            # 'sin_credenciales' y 'error' también van 200: el estado va en el
            # cuerpo y el modal decide qué mostrar.
            http_status = 200
        resultado_log = estado or "listo"
        mensaje_log = resultado.get("mensaje")
        return PjudFamiliaMovimientosResponse(**resultado)
    except PjudApiError as e:
        mensaje_log = str(e)
        diagnostico_log = e.diagnostico
        raise HTTPException(status_code=502, detail=mensaje_log)
    finally:
        _registrar_llamado_pjud(
            db_maestra,
            tenant=tenant,
            causa_id=causa_id,
            rol=causa.rol,
            tribunal=causa.tribunal,
            materia="Familia",
            forzar=forzar,
            resultado=resultado_log,
            http_status=http_status,
            mensaje=mensaje_log,
            diagnostico=diagnostico_log,
            duracion_ms=int((time.monotonic() - inicio) * 1000),
        )


@router.get(
    "/{causa_id}/pjud/laboral",
    dependencies=[Depends(requerir_pjud_habilitado)],
    response_model=PjudLaboralMovimientosResponse,
    summary="Detalle de una causa Laboral consultado en vivo al PJUD",
)
def pjud_laboral(
    causa_id: int,
    response: Response,
    forzar: bool = Query(False, description="Pide al PJUD que sincronice antes de consultar"),
    db: Session = Depends(get_db_tenant),
    tenant: TenantContexto = Depends(get_tenant_actual),
    db_maestra: Session = Depends(get_db_maestra),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Igual que `/pjud/familia` pero para causas de materia Laboral: el flujo
    de sincronización asíncrona es el mismo, cambia la forma de la respuesta
    (ver `PjudLaboralMovimientosResponse`). Laboral no tiene cuadernos, así que
    no hay parámetro `cuaderno`."""
    causa = CausaRepository(db).find_by_id(causa_id)
    if not causa:
        raise HTTPException(status_code=404, detail="Causa no encontrada")

    credenciales_dueno = credenciales_del_dueno(db, causa)

    inicio = time.monotonic()
    resultado_log = "error"
    http_status = 502
    mensaje_log: str | None = None
    diagnostico_log: str | None = None
    try:
        resultado = _detalle_pjud(
            db_maestra, tenant, db=db, causa_id=causa_id, materia="Laboral",
            rol=causa.rol, tribunal=causa.tribunal, forzar=forzar,
            consultar=lambda s: s.obtener_detalle_laboral(
                causa,
                forzar_sincronizacion=forzar,
                credenciales_dueno=credenciales_dueno,
            ),
        )
        estado = resultado.get("estado")
        diagnostico_log = resultado.pop("diagnostico", None)
        if estado == "sincronizando":
            response.status_code = http_status = 202
        else:
            # 'sin_credenciales' y 'error' también van 200: el estado va en el
            # cuerpo y el modal decide qué mostrar.
            http_status = 200
        resultado_log = estado or "listo"
        mensaje_log = resultado.get("mensaje")
        return PjudLaboralMovimientosResponse(**resultado)
    except PjudApiError as e:
        mensaje_log = str(e)
        diagnostico_log = e.diagnostico
        raise HTTPException(status_code=502, detail=mensaje_log)
    finally:
        _registrar_llamado_pjud(
            db_maestra,
            tenant=tenant,
            causa_id=causa_id,
            rol=causa.rol,
            tribunal=causa.tribunal,
            materia="Laboral",
            forzar=forzar,
            resultado=resultado_log,
            http_status=http_status,
            mensaje=mensaje_log,
            diagnostico=diagnostico_log,
            duracion_ms=int((time.monotonic() - inicio) * 1000),
        )


@router.get(
    "/{causa_id}/pjud/cobranza",
    dependencies=[Depends(requerir_pjud_habilitado)],
    response_model=PjudCobranzaMovimientosResponse,
    summary="Detalle de una causa Cobranza consultado en vivo al PJUD",
)
def pjud_cobranza(
    causa_id: int,
    response: Response,
    forzar: bool = Query(False, description="Pide al PJUD que sincronice antes de consultar"),
    cuaderno: int | None = Query(None, description="Cuaderno a traer en Historia; por defecto el primero"),
    db: Session = Depends(get_db_tenant),
    tenant: TenantContexto = Depends(get_tenant_actual),
    db_maestra: Session = Depends(get_db_maestra),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Igual que `/pjud/movimientos` (Civil) pero para causas de materia
    Cobranza: mismo flujo de sincronización asíncrona y mismo parámetro
    `cuaderno` (Cobranza sí expone cuadernos), cambia la forma de la
    respuesta (ver `PjudCobranzaMovimientosResponse`)."""
    causa = CausaRepository(db).find_by_id(causa_id)
    if not causa:
        raise HTTPException(status_code=404, detail="Causa no encontrada")

    credenciales_dueno = credenciales_del_dueno(db, causa)

    inicio = time.monotonic()
    resultado_log = "error"
    http_status = 502
    mensaje_log: str | None = None
    diagnostico_log: str | None = None
    try:
        resultado = _detalle_pjud(
            db_maestra, tenant, db=db, causa_id=causa_id, materia="Cobranza",
            rol=causa.rol, tribunal=causa.tribunal, forzar=forzar,
            consultar=lambda s: s.obtener_detalle_cobranza(
                causa,
                forzar_sincronizacion=forzar,
                cuaderno_id=cuaderno,
                credenciales_dueno=credenciales_dueno,
            ),
        )
        estado = resultado.get("estado")
        diagnostico_log = resultado.pop("diagnostico", None)
        if estado == "sincronizando":
            response.status_code = http_status = 202
        else:
            http_status = 200
        resultado_log = estado or "listo"
        mensaje_log = resultado.get("mensaje")
        return PjudCobranzaMovimientosResponse(**resultado)
    except PjudApiError as e:
        mensaje_log = str(e)
        diagnostico_log = e.diagnostico
        raise HTTPException(status_code=502, detail=mensaje_log)
    finally:
        _registrar_llamado_pjud(
            db_maestra,
            tenant=tenant,
            causa_id=causa_id,
            rol=causa.rol,
            tribunal=causa.tribunal,
            materia="Cobranza",
            forzar=forzar,
            resultado=resultado_log,
            http_status=http_status,
            mensaje=mensaje_log,
            diagnostico=diagnostico_log,
            duracion_ms=int((time.monotonic() - inicio) * 1000),
        )


@router.get(
    "/{causa_id}/pjud/penal",
    dependencies=[Depends(requerir_pjud_habilitado)],
    response_model=PjudPenalMovimientosResponse,
    summary="Detalle de una causa Penal consultado en vivo al PJUD",
)
def pjud_penal(
    causa_id: int,
    response: Response,
    forzar: bool = Query(False, description="Pide al PJUD que sincronice antes de consultar"),
    cuaderno: int | None = Query(None, description="Cuaderno a traer en Historia; por defecto el primero"),
    db: Session = Depends(get_db_tenant),
    tenant: TenantContexto = Depends(get_tenant_actual),
    db_maestra: Session = Depends(get_db_maestra),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Igual que `/pjud/laboral` pero para causas de materia Penal: mismo flujo
    de sincronización asíncrona, cambia la forma de la respuesta (ver
    `PjudPenalMovimientosResponse`). Penal expone cuadernos, así que acepta
    el parámetro `cuaderno` como Civil/Cobranza."""
    causa = CausaRepository(db).find_by_id(causa_id)
    if not causa:
        raise HTTPException(status_code=404, detail="Causa no encontrada")

    credenciales_dueno = credenciales_del_dueno(db, causa)

    inicio = time.monotonic()
    resultado_log = "error"
    http_status = 502
    mensaje_log: str | None = None
    diagnostico_log: str | None = None
    try:
        resultado = _detalle_pjud(
            db_maestra, tenant, db=db, causa_id=causa_id, materia="Penal",
            rol=causa.rol, tribunal=causa.tribunal, forzar=forzar,
            consultar=lambda s: s.obtener_detalle_penal(
                causa,
                forzar_sincronizacion=forzar,
                cuaderno_id=cuaderno,
                credenciales_dueno=credenciales_dueno,
            ),
        )
        estado = resultado.get("estado")
        diagnostico_log = resultado.pop("diagnostico", None)
        if estado == "sincronizando":
            response.status_code = http_status = 202
        else:
            # 'sin_credenciales' y 'error' también van 200: el estado va en el
            # cuerpo y el modal decide qué mostrar.
            http_status = 200
        resultado_log = estado or "listo"
        mensaje_log = resultado.get("mensaje")
        return PjudPenalMovimientosResponse(**resultado)
    except PjudApiError as e:
        mensaje_log = str(e)
        diagnostico_log = e.diagnostico
        raise HTTPException(status_code=502, detail=mensaje_log)
    finally:
        _registrar_llamado_pjud(
            db_maestra,
            tenant=tenant,
            causa_id=causa_id,
            rol=causa.rol,
            tribunal=causa.tribunal,
            materia="Penal",
            forzar=forzar,
            resultado=resultado_log,
            http_status=http_status,
            mensaje=mensaje_log,
            diagnostico=diagnostico_log,
            duracion_ms=int((time.monotonic() - inicio) * 1000),
        )


@router.get(
    "/cortes/{corte_id}/pjud/apelaciones",
    dependencies=[Depends(requerir_pjud_habilitado)],
    response_model=PjudApelacionesMovimientosResponse,
    summary="Detalle de una causa de Corte de Apelaciones consultado en vivo al PJUD",
)
def pjud_apelaciones(
    corte_id: int,
    response: Response,
    forzar: bool = Query(False, description="Pide al PJUD que sincronice antes de consultar"),
    db: Session = Depends(get_db_tenant),
    tenant: TenantContexto = Depends(get_tenant_actual),
    db_maestra: Session = Depends(get_db_maestra),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Igual que `/pjud/penal` pero para una causa de la hoja Corte de
    Apelaciones (`CausaCorte`, no `Causa`): mismo flujo de sincronización
    asíncrona, sin cuadernos. Además relaciona el expediente de primera
    instancia con la causa de la cartera (`causa_origen`), si existe."""
    causa_corte = db.get(CausaCorte, corte_id)
    if not causa_corte:
        raise HTTPException(status_code=404, detail="Causa de corte no encontrada")

    # `CausaCorte` no tiene rut propio: el dueño es el del archivo del que salió.
    origen = causa_corte.estado_diario_origen
    credenciales_dueno = credenciales_del_dueno(
        db, SimpleNamespace(rut_efectivo=origen.rut if origen else None)
    )

    inicio = time.monotonic()
    resultado_log = "error"
    http_status = 502
    mensaje_log: str | None = None
    diagnostico_log: str | None = None
    try:
        resultado = _detalle_pjud(
            db_maestra, tenant, db=db, causa_id=corte_id, materia="Apelaciones",
            rol=f"{causa_corte.rol}-{causa_corte.era}", tribunal=causa_corte.corte,
            forzar=forzar,
            consultar=lambda s: s.obtener_detalle_apelaciones(
                causa_corte,
                forzar_sincronizacion=forzar,
                credenciales_dueno=credenciales_dueno,
            ),
        )
        estado = resultado.get("estado")
        diagnostico_log = resultado.pop("diagnostico", None)
        if estado == "sincronizando":
            response.status_code = http_status = 202
        else:
            # 'sin_credenciales' y 'error' también van 200: el estado va en el
            # cuerpo y el modal decide qué mostrar.
            http_status = 200
        resultado_log = estado or "listo"
        mensaje_log = resultado.get("mensaje")
        resultado["causa_origen"] = _causa_origen_de_apelacion(db, resultado.get("causa"))
        _guardar_origen_de_apelacion(db, causa_corte, resultado.get("causa"), resultado["causa_origen"])
        return PjudApelacionesMovimientosResponse(**resultado)
    except PjudApiError as e:
        mensaje_log = str(e)
        diagnostico_log = e.diagnostico
        raise HTTPException(status_code=502, detail=mensaje_log)
    finally:
        _registrar_llamado_pjud(
            db_maestra,
            tenant=tenant,
            # Es un id de `causa_corte`: se distingue de los de `Causa` por la
            # materia 'Apelaciones' (ver `ultimos_por_causa`).
            causa_id=corte_id,
            rol=f"{causa_corte.rol}-{causa_corte.era}",
            tribunal=causa_corte.corte,
            materia="Apelaciones",
            forzar=forzar,
            resultado=resultado_log,
            http_status=http_status,
            mensaje=mensaje_log,
            diagnostico=diagnostico_log,
            duracion_ms=int((time.monotonic() - inicio) * 1000),
        )


def _guardar_origen_de_apelacion(
    db: Session, causa_corte: CausaCorte, detalle: dict | None, causa_origen: dict | None
) -> None:
    """Anota en `causa_corte` la causa de primera instancia del expediente, para
    poder filtrar el listado por ella. Mejor esfuerzo: un fallo acá no puede
    impedir que el estudio vea el detalle."""
    primera = (detalle or {}).get("expediente_primera") or {}
    rol = "".join((primera.get("causa_origen") or "").split()) or None
    tribunal = (primera.get("tribunal") or "").strip() or None
    if not rol:
        return
    nuevo = (rol, tribunal, causa_origen["id"] if causa_origen else None)
    if nuevo == (causa_corte.origen_rol, causa_corte.origen_tribunal, causa_corte.origen_causa_id):
        return
    try:
        causa_corte.origen_rol, causa_corte.origen_tribunal, causa_corte.origen_causa_id = nuevo
        db.commit()
    except Exception:
        db.rollback()
        logger.warning(
            "No se pudo guardar la causa origen de la causa de corte %s", causa_corte.id, exc_info=True
        )


def _causa_origen_de_apelacion(db: Session, detalle: dict | None) -> dict | None:
    """La causa de la cartera que calza con `expediente_primera` (rol y tribunal
    de primera instancia), o None. El PJUD escribe el rol con espacios
    (`C - 711 - 2026`) y la cartera sin ellos (`C-711-2026`)."""
    primera = (detalle or {}).get("expediente_primera") or {}
    rol = "".join((primera.get("causa_origen") or "").split())
    tribunal = (primera.get("tribunal") or "").strip()
    if not rol or not tribunal:
        return None
    causa = CausaRepository(db).find_pjud_por_rol_tribunal(rol, tribunal)
    if not causa:
        return None
    return {
        "id": causa.id, "rol": causa.rol, "tribunal": causa.tribunal,
        "materia": causa.materia, "caratulado": causa.caratulado,
    }


# ── Sincronizar y consultar el estado (sistemas externos) ─────────────────

# materia → (método de `PjudService` que sincroniza y consulta, segmento de la
# ruta del GET que trae el detalle de esa materia).
_SINCRONIZAR_POR_MATERIA = {
    "Civil": ("obtener_detalle", "movimientos"),
    "Familia": ("obtener_detalle_familia", "familia"),
    "Laboral": ("obtener_detalle_laboral", "laboral"),
    "Cobranza": ("obtener_detalle_cobranza", "cobranza"),
    "Penal": ("obtener_detalle_penal", "penal"),
}


def _rutas_pjud(causa_id: int, materia: str) -> tuple[str, str]:
    """(consultar_estado, consultar_detalle) de la causa."""
    if materia == "Apelaciones":
        base = f"/api/v1/causas/cortes/{causa_id}/pjud"
        return f"{base}/estado", f"{base}/apelaciones"
    base = f"/api/v1/causas/{causa_id}/pjud"
    return f"{base}/estado", f"{base}/{_SINCRONIZAR_POR_MATERIA[materia][1]}"


def _materia_sincronizable(causa) -> str:
    materia = materia_canonica(causa.materia or "")
    if materia not in _SINCRONIZAR_POR_MATERIA:
        raise HTTPException(
            status_code=422,
            detail="La causa no es de una materia que se pueda sincronizar con el PJUD",
        )
    return materia


def _encolar_sincronizacion(
    db_maestra, tenant, *, causa_id, materia, rol, tribunal, consultar, db=None
) -> PjudSincronizarResponse:
    """Encola un `sincronizar_*` (sin esperar a que termine) y dice qué quedó.

    Si ya hay un job en curso no encola otro: api-pjud exige 30 minutos entre
    syncs de una misma causa y respondería 409."""
    estado_url, detalle_url = _rutas_pjud(causa_id, materia)
    apelaciones = materia == "Apelaciones"
    previo = _sincronizaciones_pjud(
        db_maestra, tenant.cliente_id, [causa_id], apelaciones
    ).get(causa_id)
    if previo is not None and previo.estado == SINC_SINCRONIZANDO:
        return PjudSincronizarResponse(
            causa_id=causa_id, materia=materia, estado="sincronizando",
            job_id=previo.job_id, ya_en_curso=True, mensaje=_MENSAJE_SINCRONIZANDO,
            consultar_estado=estado_url, consultar_detalle=detalle_url,
        )

    inicio = time.monotonic()
    resultado_log, http_status = "error", 502
    mensaje_log = diagnostico_log = None
    try:
        resultado = _detalle_pjud(
            db_maestra, tenant, db=db, causa_id=causa_id, materia=materia, rol=rol,
            tribunal=tribunal, forzar=True, consultar=consultar,
        )
        http_status = 202
        resultado_log = resultado.get("estado") or "listo"
        mensaje_log = resultado.get("mensaje")
        diagnostico_log = resultado.get("diagnostico")
        nuevo = _sincronizaciones_pjud(
            db_maestra, tenant.cliente_id, [causa_id], apelaciones
        ).get(causa_id)
        if nuevo is not None and (previo is None or nuevo.job_id != previo.job_id):
            # Se encoló un job: ese es el estado, sea cual sea lo que ya tuviera
            # guardado el proveedor de la causa.
            return PjudSincronizarResponse(
                causa_id=causa_id, materia=materia, estado="sincronizando",
                job_id=nuevo.job_id, mensaje=_MENSAJE_SINCRONIZANDO,
                consultar_estado=estado_url, consultar_detalle=detalle_url,
            )
        return PjudSincronizarResponse(
            causa_id=causa_id, materia=materia,
            estado=resultado.get("estado") or "listo", mensaje=resultado.get("mensaje"),
            consultar_estado=estado_url, consultar_detalle=detalle_url,
        )
    except PjudApiError as e:
        mensaje_log = str(e)
        diagnostico_log = e.diagnostico
        raise HTTPException(status_code=502, detail=mensaje_log)
    finally:
        _registrar_llamado_pjud(
            db_maestra, tenant=tenant, causa_id=causa_id, rol=rol, tribunal=tribunal,
            materia=materia, forzar=True, resultado=resultado_log, http_status=http_status,
            mensaje=mensaje_log, diagnostico=diagnostico_log,
            duracion_ms=int((time.monotonic() - inicio) * 1000),
        )


def _estado_sincronizacion(
    db_maestra, tenant, *, causa_id, materia
) -> PjudEstadoSincronizacionResponse:
    fila = _sincronizaciones_pjud(
        db_maestra, tenant.cliente_id, [causa_id], materia == "Apelaciones"
    ).get(causa_id)
    return PjudEstadoSincronizacionResponse(
        causa_id=causa_id,
        materia=materia,
        estado=fila.estado if fila else "sin_sincronizar",
        job_id=fila.job_id if fila else None,
        mensaje_error=fila.mensaje_error if fila else None,
        iniciado_en=fila.creado_en if fila else None,
        actualizado_en=fila.actualizado_en if fila else None,
        consultar_detalle=_rutas_pjud(causa_id, materia)[1],
    )


@router.post(
    "/{causa_id}/pjud/sincronizar",
    status_code=202,
    dependencies=[Depends(requerir_pjud_habilitado)],
    response_model=PjudSincronizarResponse,
    summary="Pide a api-pjud que sincronice una causa (no espera el resultado)",
)
def pjud_sincronizar(
    causa_id: int,
    db: Session = Depends(get_db_tenant),
    tenant: TenantContexto = Depends(get_tenant_actual),
    db_maestra: Session = Depends(get_db_maestra),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Para sistemas externos con API key de escritura. Responde de inmediato;
    el avance se consulta en `consultar_estado` y los datos en `consultar_detalle`."""
    causa = CausaRepository(db).find_by_id(causa_id)
    if not causa:
        raise HTTPException(status_code=404, detail="Causa no encontrada")
    materia = _materia_sincronizable(causa)
    credenciales_dueno = credenciales_del_dueno(db, causa)
    metodo = _SINCRONIZAR_POR_MATERIA[materia][0]
    return _encolar_sincronizacion(
        db_maestra, tenant, db=db, causa_id=causa_id, materia=materia,
        rol=causa.rol, tribunal=causa.tribunal,
        consultar=lambda s: getattr(s, metodo)(
            causa, forzar_sincronizacion=True, credenciales_dueno=credenciales_dueno
        ),
    )


@router.post(
    "/cortes/{corte_id}/pjud/sincronizar",
    status_code=202,
    dependencies=[Depends(requerir_pjud_habilitado)],
    response_model=PjudSincronizarResponse,
    summary="Pide a api-pjud que sincronice una causa de Corte de Apelaciones",
)
def pjud_sincronizar_apelaciones(
    corte_id: int,
    db: Session = Depends(get_db_tenant),
    tenant: TenantContexto = Depends(get_tenant_actual),
    db_maestra: Session = Depends(get_db_maestra),
    current_user: Usuario = Depends(get_usuario_actual),
):
    causa_corte = db.get(CausaCorte, corte_id)
    if not causa_corte:
        raise HTTPException(status_code=404, detail="Causa de corte no encontrada")
    origen = causa_corte.estado_diario_origen
    credenciales_dueno = credenciales_del_dueno(
        db, SimpleNamespace(rut_efectivo=origen.rut if origen else None)
    )
    return _encolar_sincronizacion(
        db_maestra, tenant, db=db, causa_id=corte_id, materia="Apelaciones",
        rol=f"{causa_corte.rol}-{causa_corte.era}", tribunal=causa_corte.corte,
        consultar=lambda s: s.obtener_detalle_apelaciones(
            causa_corte, forzar_sincronizacion=True, credenciales_dueno=credenciales_dueno
        ),
    )


@router.get(
    "/{causa_id}/pjud/estado",
    dependencies=[Depends(requerir_pjud_habilitado)],
    response_model=PjudEstadoSincronizacionResponse,
    summary="Estado de la última sincronización PJUD de una causa (liviano, sin llamar a api-pjud)",
)
def pjud_estado(
    causa_id: int,
    db: Session = Depends(get_db_tenant),
    tenant: TenantContexto = Depends(get_tenant_actual),
    db_maestra: Session = Depends(get_db_maestra),
    current_user: Usuario = Depends(get_usuario_actual),
):
    causa = CausaRepository(db).find_by_id(causa_id)
    if not causa:
        raise HTTPException(status_code=404, detail="Causa no encontrada")
    return _estado_sincronizacion(
        db_maestra, tenant, causa_id=causa_id, materia=_materia_sincronizable(causa)
    )


@router.get(
    "/cortes/{corte_id}/pjud/estado",
    dependencies=[Depends(requerir_pjud_habilitado)],
    response_model=PjudEstadoSincronizacionResponse,
    summary="Estado de la última sincronización PJUD de una causa de Corte de Apelaciones",
)
def pjud_estado_apelaciones(
    corte_id: int,
    db: Session = Depends(get_db_tenant),
    tenant: TenantContexto = Depends(get_tenant_actual),
    db_maestra: Session = Depends(get_db_maestra),
    current_user: Usuario = Depends(get_usuario_actual),
):
    if not db.get(CausaCorte, corte_id):
        raise HTTPException(status_code=404, detail="Causa de corte no encontrada")
    return _estado_sincronizacion(
        db_maestra, tenant, causa_id=corte_id, materia="Apelaciones"
    )


@router.post(
    "/pjud/callback",
    response_model=PjudCallbackResponse,
    summary="Aviso de api-pjud al terminar un sincronizar_*",
)
def pjud_callback(
    datos: PjudCallbackRequest,
    db_maestra: Session = Depends(get_db_maestra),
):
    """Webhook público: api-pjud lo llama con el `callback_url` que le enviamos
    en cada `sincronizar_*`. Sin `get_tenant_actual` ni Bearer a propósito
    (arrastran HTTPBearer y devolverían 403); la única validación es que el
    `job_id` exista en `pjud_sincronizacion`, de donde sale el cliente.

    Éxito → la sincronización queda `listo` (el botón pasa al martillo). Error →
    queda `error` con el `mensaje_error`. Siempre 200: un job desconocido no se
    arregla reintentando."""
    fila = PjudSincronizacionRepository(db_maestra).cerrar(
        datos.job_id, exito=datos.exito, mensaje_error=datos.mensaje_error
    )
    if fila is not None and fila.causa_id is None and fila.rol is None:
        # Aún no registramos ese job: el aviso llegó antes que la respuesta del
        # `sincronizar_*`. Queda guardado y `registrar` lo completa.
        logger.info("Callback de api-pjud adelantado al registro del job: %s", datos.job_id)
    return PjudCallbackResponse(exito=fila is not None)


class _GuardiaSync:
    """Reserva del cupo de sync de una causa para `PjudService._sincronizar`.

    Comparte `PjudSincronizacionRepository.reservar` con el espejo, así que la app
    y el integrador no se pisan. `confirmar` y `liberar` nunca lanzan."""

    def __init__(self, repo, db_maestra, *, cliente_id, causa_id, materia, rol, tribunal):
        self._repo, self._db = repo, db_maestra
        self._datos = dict(
            cliente_id=cliente_id, causa_id=causa_id, materia=materia, rol=rol, tribunal=tribunal
        )
        self.registrado = False  # el job ya quedó guardado con su job_id real

    def reservar(self):
        """La reserva, o None si ya hay un sync en curso de la causa."""
        fila, nueva = self._repo.reservar(**self._datos)
        return fila if nueva else None

    def confirmar(self, reserva, job_id: str) -> bool:
        try:
            self._repo.confirmar(reserva, job_id)
        except Exception:
            self._db.rollback()
            logger.exception("No se pudo confirmar el job %s de api-pjud", job_id)
            return False
        self.registrado = True
        return True

    def liberar(self, reserva) -> None:
        try:
            self._repo.liberar(reserva)
        except Exception:
            self._db.rollback()
            logger.exception("No se pudo soltar la reserva de sync (vence sola)")


def _detalle_pjud(
    db_maestra, tenant, *, causa_id, materia, rol, tribunal, forzar, consultar, db=None
) -> dict:
    """Corre `consultar(servicio)` (el `obtener_detalle_*` de la materia), pero
    el estado de la sincronización sale de `pjud_sincronizacion`, no de
    `consultar_*`: con un job en curso (o terminado en error) se responde desde
    la base sin tocar al proveedor. `forzar` salta ese atajo y encola otro job.

    Cuando el servicio encola un `sincronizar_*` y api-pjud devuelve `job_id`,
    queda guardado como `sincronizando` hasta que llegue el callback.

    `db` (la base del cliente) permite descartar la copia que el espejo de api-pjud
    tiene de esa causa cuando se encola un sync por cualquier vía: sin eso, una
    consulta del espejo justo después devolvería el detalle anterior."""
    apelaciones = materia == "Apelaciones"
    repo = PjudSincronizacionRepository(db_maestra)
    enfriando = False
    if not forzar:
        try:
            sincronizacion = repo.ultimo_de_causa(
                cliente_id=tenant.cliente_id, causa_id=causa_id, apelaciones=apelaciones
            )
        except Exception:
            # Sin la tabla (despliegue a medio hacer) se cae al flujo anterior.
            logger.exception("No se pudo leer pjud_sincronizacion")
            db_maestra.rollback()
            sincronizacion = None
        if sincronizacion and sincronizacion.estado == SINC_SINCRONIZANDO:
            return {
                "estado": "sincronizando",
                "mensaje": _MENSAJE_SINCRONIZANDO,
                "detalle_estado": None,
                "diagnostico": f"estado desde BD: sincronizando job_id={sincronizacion.job_id}",
            }
        if sincronizacion and sincronizacion.estado == SINC_ERROR:
            error = {
                "estado": "error",
                "mensaje": _MENSAJE_ERROR_SYNC,
                "detalle_estado": sincronizacion.mensaje_error,
                "ultimo_error": sincronizacion.mensaje_error,
                "diagnostico": f"estado desde BD: error job_id={sincronizacion.job_id}",
            }
            # Que el job haya fallado no borra lo que api-pjud ya tenía de la
            # causa: se lee con `consultar_*` (sin encolar otro sync) y se
            # entrega junto al error, para que la pantalla muestre ambos.
            try:
                servicio = PjudService()
                servicio.solo_lectura = True
                datos = consultar(servicio)
            except Exception:
                logger.exception("No se pudieron leer los datos previos de la causa %s", causa_id)
                return error
            if not datos.get("causa"):
                return error
            return {**datos, **error, "diagnostico": f"{error['diagnostico']} · {datos.get('diagnostico')}"}
        # Recién terminó un sync: se lee lo que api-pjud ya tiene, sin encolar otro
        # aunque `consultar_*` todavía diga "sincronizando" (ver `enfriando`).
        enfriando = bool(sincronizacion and repo.enfriando(sincronizacion))

    servicio = PjudService()
    if enfriando:
        servicio.solo_lectura = True
    guardia = _GuardiaSync(
        repo, db_maestra, cliente_id=tenant.cliente_id, causa_id=causa_id,
        materia=materia, rol=rol, tribunal=tribunal,
    )
    servicio.guardia = guardia
    try:
        return consultar(servicio)
    finally:
        _descartar_copias(db, servicio)
        if servicio.job_id and not guardia.registrado:
            try:
                repo.registrar(
                    job_id=servicio.job_id,
                    cliente_id=tenant.cliente_id,
                    causa_id=causa_id,
                    materia=materia,
                    rol=rol,
                    tribunal=tribunal,
                )
            except Exception:
                db_maestra.rollback()
                logger.exception("No se pudo guardar el job %s de api-pjud", servicio.job_id)


def _descartar_copias(db, servicio) -> None:
    """Borra la copia del espejo de cada causa cuyo sync se acaba de encolar. La
    clave es el cuerpo `sincronizar_*` de la causa, el mismo de `consultar_*`. Nunca
    revienta: en el peor caso la copia vence sola por TTL."""
    if db is None or not servicio.encolados:
        return
    try:
        copias = PjudCopiaRepository(db)
        for competencia, cuerpo in servicio.encolados:
            copias.borrar_de_causa(f"/consultar_{competencia}", clave_de(cuerpo))
    except Exception:
        db.rollback()
        logger.exception("No se pudo descartar la copia PJUD tras encolar el sync")


def _sincronizaciones_pjud(db_maestra, cliente_id, causa_ids, apelaciones=False) -> dict:
    """Último job de sincronización por causa. Si la tabla no está (despliegue a
    medio hacer) devuelve vacío y el listado cae al log de llamados."""
    try:
        return PjudSincronizacionRepository(db_maestra).ultimos_por_causa(
            cliente_id=cliente_id, causa_ids=causa_ids, apelaciones=apelaciones
        )
    except Exception:
        logger.exception("No se pudo leer pjud_sincronizacion")
        db_maestra.rollback()
        return {}


def _aplicar_estado_pjud(respuesta, llamado, sincronizacion) -> None:
    """Pinta `pjud_estado` y `pjud_fecha_sincronizacion` con lo más reciente entre
    el último job de sincronización y el último llamado de consulta."""
    if sincronizacion and (
        llamado is None or _aware(sincronizacion.actualizado_en) >= _aware(llamado.fecha_hora)
    ):
        respuesta.pjud_estado = sincronizacion.estado
        respuesta.pjud_fecha_sincronizacion = sincronizacion.actualizado_en
    elif llamado:
        respuesta.pjud_estado = llamado.resultado
        respuesta.pjud_fecha_sincronizacion = llamado.fecha_hora


def _aware(fecha):
    return fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)


def _registrar_llamado_pjud(db_maestra, *, tenant, causa_id, rol, tribunal, forzar,
                            resultado, http_status, mensaje, diagnostico, duracion_ms,
                            materia=None) -> None:
    """Anota la consulta en la base principal. Nunca revienta hacia afuera: un
    fallo del log no puede impedir que el estudio vea su causa."""
    try:
        PjudLlamadoRepository(db_maestra).registrar(
            cliente_id=tenant.cliente_id,
            guid=tenant.guid,
            usuario_id=tenant.usuario_id,
            causa_id=causa_id,
            rol=rol,
            tribunal=tribunal,
            materia=materia,
            forzar=forzar,
            resultado=resultado,
            http_status=http_status,
            mensaje=mensaje,
            diagnostico=diagnostico,
            duracion_ms=duracion_ms,
        )
    except Exception:
        logger.exception("No se pudo registrar el llamado a api-pjud")
