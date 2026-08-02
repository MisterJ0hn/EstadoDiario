"""Ingesta de adjuntos de estado diario desde una casilla IMAP.

Gmail no necesita un cliente aparte: se conecta como IMAP estándar
(imap.gmail.com:993 con SSL) usando una contraseña de aplicación, que exige
tener la verificación en dos pasos activa en la cuenta. Por eso hay una sola
implementación y Gmail queda como un preset de host/puerto en la UI.
"""

import email
import imaplib
import logging
import os
import uuid
from datetime import datetime, timezone
from email.header import decode_header, make_header
from email.utils import parseaddr
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import UPLOAD_DIR
from app.core.crypto import descifrar
from app.models.configuracion_correo import ConfiguracionCorreo
from app.models.correo_log import (
    CorreoLog,
    RESULTADO_CONEXION,
    RESULTADO_DESCARTADO,
    RESULTADO_DUPLICADO,
    RESULTADO_ERROR,
    RESULTADO_IMPORTADO,
)
from app.repositories.configuracion_correo_repository import ConfiguracionCorreoRepository
from app.repositories.correo_log_repository import CorreoLogRepository
from app.services.import_service import ImportService

logger = logging.getLogger(__name__)

EXTENSIONES_VALIDAS = (".xls", ".xlsx", ".xlsm")


class ErrorConfiguracion(Exception):
    """La configuración está incompleta o desactivada."""


def _decodificar(valor: Optional[str]) -> str:
    """Decodifica cabeceras MIME (=?UTF-8?B?...?=) a texto legible."""
    if not valor:
        return ""
    try:
        return str(make_header(decode_header(valor)))
    except Exception:
        return valor


class CorreoService:
    def __init__(self, db: Session):
        self.db = db
        self.config_repo = ConfiguracionCorreoRepository(db)
        self.log_repo = CorreoLogRepository(db)
        # Dueño de la casilla que se está revisando. Se fija en revisar() y lo
        # lee _log(), que se invoca desde una decena de puntos: pasarlo por
        # parámetro en todos ellos era mucha superficie para olvidarse en uno.
        self._usuario_actual: Optional[int] = None

    # ── Conexión ──────────────────────────────────────────

    def _conectar(self, config: ConfiguracionCorreo, password: str):
        if config.usar_ssl:
            client = imaplib.IMAP4_SSL(config.host, config.puerto)
        else:
            client = imaplib.IMAP4(config.host, config.puerto)
        client.login(config.usuario, password)
        return client

    def _password_en_claro(self, config: ConfiguracionCorreo, override: Optional[str]) -> str:
        if override:
            return override
        if not config.password_cifrado:
            raise ErrorConfiguracion("No hay contraseña guardada para la casilla de correo")
        return descifrar(config.password_cifrado)

    def probar_conexion(self, usuario_id: int, password_override: Optional[str] = None) -> dict:
        """Valida credenciales y carpeta sin importar nada, sobre la casilla
        del usuario indicado.

        `password_override` permite probar una contraseña recién escrita en el
        formulario antes de guardarla.
        """
        config = self.config_repo.get_or_create(usuario_id)
        if not config.usuario:
            return {"exito": False, "mensaje": "Falta el usuario de la casilla"}

        try:
            password = self._password_en_claro(config, password_override)
        except (ErrorConfiguracion, ValueError) as e:
            return {"exito": False, "mensaje": str(e)}

        client = None
        try:
            client = self._conectar(config, password)
            estado, datos = client.select(config.carpeta, readonly=True)
            if estado != "OK":
                return {
                    "exito": False,
                    "mensaje": f"No se pudo abrir la carpeta '{config.carpeta}'",
                }
            total = int(datos[0]) if datos and datos[0] else 0
            return {
                "exito": True,
                "mensaje": f"Conexión correcta. {total} mensajes en '{config.carpeta}'.",
            }
        except imaplib.IMAP4.error as e:
            # Gmail responde AUTHENTICATIONFAILED cuando falta la contraseña
            # de aplicación o el admin de Workspace las tiene bloqueadas.
            return {"exito": False, "mensaje": f"Error de autenticación IMAP: {e}"}
        except Exception as e:
            return {"exito": False, "mensaje": f"No se pudo conectar: {e}"}
        finally:
            self._cerrar(client)

    @staticmethod
    def _cerrar(client) -> None:
        if client is None:
            return
        try:
            client.close()
        except Exception:
            pass
        try:
            client.logout()
        except Exception:
            pass

    # ── Ingesta ───────────────────────────────────────────

    def revisar_todas(self, disparo: str = "automatico") -> dict:
        """Recorre TODAS las casillas activas, una por usuario.

        Es lo que ejecuta el job programado: ya no existe una casilla única del
        sistema. Un fallo en la casilla de un usuario (credencial vencida, por
        ejemplo) no puede impedir que se revisen las demás, así que cada una va
        en su propio try.
        """
        configs = self.config_repo.find_activas()
        if not configs:
            return {
                "exito": True,
                "mensaje": "No hay casillas de correo activas configuradas",
                "casillas": 0,
                "procesados": 0,
            }

        total = {"importados": 0, "descartados": 0, "duplicados": 0, "errores": 0}
        detalle_por_usuario = []

        for config in configs:
            try:
                resultado = self.revisar(config.usuario_id, disparo)
            except Exception as e:
                logger.exception(
                    "Fallo revisando la casilla del usuario %s", config.usuario_id
                )
                resultado = {"exito": False, "mensaje": str(e)}

            detalle_por_usuario.append(
                {
                    "usuario_id": config.usuario_id,
                    "exito": resultado.get("exito", False),
                    "mensaje": resultado.get("mensaje", ""),
                }
            )
            for clave in total:
                total[clave] += resultado.get(clave, 0)

        return {
            "exito": True,
            "casillas": len(configs),
            "procesados": sum(total.values()),
            "detalle": detalle_por_usuario,
            **total,
        }

    def revisar(self, usuario_id: int, disparo: str = "manual") -> dict:
        """Recorre la casilla DEL USUARIO indicado e importa sus adjuntos.

        Todo lo que se importe queda a nombre de ese usuario y ningún otro lo
        verá. Devuelve un resumen y deja una fila en correo_log por cada
        adjunto evaluado, incluidos los descartados.
        """
        config = self.config_repo.get_or_create(usuario_id)
        self._usuario_actual = usuario_id

        if not config.activo:
            return {"exito": False, "mensaje": "La ingesta por correo está desactivada", "procesados": 0}
        if not config.usuario or not config.password_cifrado:
            return {"exito": False, "mensaje": "Falta configurar usuario y contraseña", "procesados": 0}
        if not config.lista_remitentes:
            # Sin lista blanca, cualquiera que conozca la dirección puede
            # inyectar movimientos en la base.
            return {
                "exito": False,
                "mensaje": "Debe configurar al menos un remitente permitido antes de activar la ingesta",
                "procesados": 0,
            }

        try:
            password = self._password_en_claro(config, None)
        except (ErrorConfiguracion, ValueError) as e:
            self._log(RESULTADO_CONEXION, detalle=str(e), disparo=disparo)
            return {"exito": False, "mensaje": str(e), "procesados": 0}

        client = None
        resumen = {"importados": 0, "descartados": 0, "duplicados": 0, "errores": 0}

        try:
            client = self._conectar(config, password)
            estado, _ = client.select(config.carpeta)
            if estado != "OK":
                mensaje = f"No se pudo abrir la carpeta '{config.carpeta}'"
                self._log(RESULTADO_CONEXION, detalle=mensaje, disparo=disparo)
                return {"exito": False, "mensaje": mensaje, "procesados": 0}

            estado, datos = client.search(None, "UNSEEN")
            if estado != "OK":
                mensaje = "La búsqueda IMAP falló"
                self._log(RESULTADO_CONEXION, detalle=mensaje, disparo=disparo)
                return {"exito": False, "mensaje": mensaje, "procesados": 0}

            ids = datos[0].split() if datos and datos[0] else []
            logger.info("Ingesta de correo: %d mensajes sin leer en %s", len(ids), config.carpeta)

            for num in ids:
                self._procesar_mensaje(client, num, config, disparo, usuario_id, resumen)

        except imaplib.IMAP4.error as e:
            self._log(RESULTADO_CONEXION, detalle=f"Error IMAP: {e}", disparo=disparo)
            return {"exito": False, "mensaje": f"Error IMAP: {e}", "procesados": 0}
        except Exception as e:
            logger.exception("Fallo inesperado en la ingesta de correo")
            self._log(RESULTADO_CONEXION, detalle=str(e), disparo=disparo)
            return {"exito": False, "mensaje": f"Error inesperado: {e}", "procesados": 0}
        finally:
            self._cerrar(client)

        procesados = sum(resumen.values())
        if procesados == 0:
            # Que no llegue nada también es información para el administrador.
            self._log(
                RESULTADO_DESCARTADO,
                detalle="No se encontraron mensajes nuevos con adjuntos válidos",
                disparo=disparo,
            )

        config.ultima_ejecucion = datetime.now(timezone.utc)
        config.ultimo_resultado = (
            f"{resumen['importados']} importados, {resumen['descartados']} descartados, "
            f"{resumen['duplicados']} duplicados, {resumen['errores']} errores"
        )
        self.config_repo.save(config)

        return {"exito": True, "mensaje": config.ultimo_resultado, "procesados": procesados, **resumen}

    def _procesar_mensaje(self, client, num, config, disparo, usuario_id, resumen) -> None:
        estado, datos = client.fetch(num, "(RFC822)")
        if estado != "OK" or not datos or not datos[0]:
            resumen["errores"] += 1
            self._log(RESULTADO_ERROR, detalle=f"No se pudo leer el mensaje {num!r}", disparo=disparo)
            return

        mensaje = email.message_from_bytes(datos[0][1])
        message_id = (mensaje.get("Message-ID") or "").strip()[:500]
        asunto = _decodificar(mensaje.get("Subject"))[:500]
        remitente_raw = _decodificar(mensaje.get("From"))
        remitente = parseaddr(remitente_raw)[1].lower()

        # ── Filtros ──
        if remitente not in config.lista_remitentes:
            resumen["descartados"] += 1
            self._log(
                RESULTADO_DESCARTADO, message_id=message_id, remitente=remitente, asunto=asunto,
                detalle=f"Remitente '{remitente}' no está en la lista de permitidos",
                disparo=disparo,
            )
            return

        if config.asunto_contiene and config.asunto_contiene.lower() not in asunto.lower():
            resumen["descartados"] += 1
            self._log(
                RESULTADO_DESCARTADO, message_id=message_id, remitente=remitente, asunto=asunto,
                detalle=f"El asunto no contiene '{config.asunto_contiene}'",
                disparo=disparo,
            )
            return

        adjuntos = 0
        for parte in mensaje.walk():
            if parte.get_content_maintype() == "multipart":
                continue
            if parte.get("Content-Disposition") is None:
                continue

            nombre_original = _decodificar(parte.get_filename())
            if not nombre_original:
                continue

            adjuntos += 1
            self._procesar_adjunto(
                parte, nombre_original, config, message_id, remitente, asunto,
                disparo, usuario_id, resumen,
            )

        if adjuntos == 0:
            resumen["descartados"] += 1
            self._log(
                RESULTADO_DESCARTADO, message_id=message_id, remitente=remitente, asunto=asunto,
                detalle="El mensaje no trae adjuntos", disparo=disparo,
            )
            return

        if config.marcar_como_leido:
            try:
                client.store(num, "+FLAGS", "\\Seen")
            except Exception:
                logger.warning("No se pudo marcar como leído el mensaje %r", num)

    def _procesar_adjunto(
        self, parte, nombre_original, config, message_id, remitente, asunto,
        disparo, usuario_id, resumen,
    ) -> None:
        # Import local para no crear un ciclo con el módulo de endpoints
        from app.api.v1.endpoints.estado_diario import _parse_filename
        from app.models.estado_diario_origen import EstadoDiarioOrigen
        from app.services.movimiento_import_service import (
            MovimientoImportService,
            parse_nombre_archivo as parse_nombre_movimientos,
        )

        ext = os.path.splitext(nombre_original)[1].lower()
        if ext not in EXTENSIONES_VALIDAS:
            resumen["descartados"] += 1
            self._log(
                RESULTADO_DESCARTADO, message_id=message_id, remitente=remitente, asunto=asunto,
                nombre_archivo=nombre_original,
                detalle=f"Extensión '{ext}' no permitida", disparo=disparo,
            )
            return

        contenido = parte.get_payload(decode=True)
        if not contenido:
            resumen["errores"] += 1
            self._log(
                RESULTADO_ERROR, message_id=message_id, remitente=remitente, asunto=asunto,
                nombre_archivo=nombre_original, detalle="Adjunto vacío o ilegible", disparo=disparo,
            )
            return

        tamano_mb = len(contenido) / (1024 * 1024)
        if tamano_mb > config.max_tamano_mb:
            resumen["descartados"] += 1
            self._log(
                RESULTADO_DESCARTADO, message_id=message_id, remitente=remitente, asunto=asunto,
                nombre_archivo=nombre_original,
                detalle=f"El adjunto pesa {tamano_mb:.1f} MB y el máximo es {config.max_tamano_mb} MB",
                disparo=disparo,
            )
            return

        if self.log_repo.ya_importado(message_id, nombre_original, self._usuario_actual):
            resumen["duplicados"] += 1
            self._log(
                RESULTADO_DUPLICADO, message_id=message_id, remitente=remitente, asunto=asunto,
                nombre_archivo=nombre_original,
                detalle="Este adjunto ya se había importado", disparo=disparo,
            )
            return

        # RUT, fecha Y TIPO salen del nombre; por correo no hay quien los
        # escriba. El tipo decide a qué parser va: los dos Excel del PJUD
        # tienen columnas distintas y no son intercambiables.
        rut, fecha = _parse_filename(nombre_original)
        tipo = EstadoDiarioOrigen.TIPO_ESTADO_DIARIO

        if not rut or not fecha:
            rut, fecha = parse_nombre_movimientos(nombre_original)
            tipo = EstadoDiarioOrigen.TIPO_MOVIMIENTOS

        if not rut or not fecha:
            resumen["descartados"] += 1
            self._log(
                RESULTADO_DESCARTADO, message_id=message_id, remitente=remitente, asunto=asunto,
                nombre_archivo=nombre_original,
                detalle=(
                    "No se pudo deducir RUT y fecha del nombre. Formatos esperados: "
                    "EstadoDiario{RUT}_{DD}_{MM}_{YYYY}.xls o "
                    "Movimientos_{RUT}_{DD}_{MM}_{YYYY}.xls"
                ),
                disparo=disparo,
            )
            return

        # Nunca usar el nombre del correo para construir la ruta en disco.
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        destino = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
        with open(destino, "wb") as f:
            f.write(contenido)

        try:
            if tipo == EstadoDiarioOrigen.TIPO_MOVIMIENTOS:
                servicio = MovimientoImportService(self.db)
            else:
                servicio = ImportService(self.db)
            resultado = servicio.import_file(
                destino, rut, fecha, usuario_id, nombre_original
            )
        except Exception as e:
            self.db.rollback()
            logger.exception("Fallo al importar el adjunto %s", nombre_original)
            resumen["errores"] += 1
            self._log(
                RESULTADO_ERROR, message_id=message_id, remitente=remitente, asunto=asunto,
                nombre_archivo=nombre_original, detalle=str(e), disparo=disparo,
            )
            return

        resumen["importados"] += 1
        self._log(
            RESULTADO_IMPORTADO, message_id=message_id, remitente=remitente, asunto=asunto,
            nombre_archivo=nombre_original,
            detalle=f"RUT {rut}, fecha {fecha}",
            origen_id=resultado.get("origen_id"),
            movimientos=resultado.get("movimientos_importados"),
            disparo=disparo,
        )

    # ── Bitácora ──────────────────────────────────────────

    def _log(
        self, resultado: str, message_id: str = "", remitente: str = "", asunto: str = "",
        nombre_archivo: Optional[str] = None, detalle: Optional[str] = None,
        origen_id: Optional[int] = None, movimientos: Optional[int] = None,
        disparo: str = "manual",
    ) -> None:
        self.log_repo.create(CorreoLog(
            usuario_id=self._usuario_actual,
            message_id=message_id or None,
            remitente=remitente or None,
            asunto=asunto or None,
            nombre_archivo=nombre_archivo,
            resultado=resultado,
            detalle=detalle,
            estado_diario_origen_id=origen_id,
            movimientos_importados=movimientos,
            disparo=disparo,
        ))
