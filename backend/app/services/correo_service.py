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
from app.models.maestra.configuracion_correo import ConfiguracionCorreo
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
from app.services import deteccion_archivo
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
    """Trabaja contra DOS bases a la vez, y por eso recibe dos sesiones.

    La configuración de la casilla vive en la base principal (es por cliente) y
    todo lo que se importa —archivos, movimientos, bitácora— va a la base de
    ese cliente. Mezclarlas sería escribir el estado diario de un estudio en la
    base de otro.
    """

    def __init__(self, db: Session, db_maestra: Session):
        # Base del cliente: acá se escribe lo importado y la bitácora.
        self.db = db
        # Base principal: solo la configuración de la casilla.
        self.config_repo = ConfiguracionCorreoRepository(db_maestra)
        self.log_repo = CorreoLogRepository(db)
        # Usuario de la base del cliente a nombre de quien queda lo importado.
        # Se fija en revisar() y lo lee _log(), que se invoca desde una decena
        # de puntos: pasarlo por parámetro en todos ellos era mucha superficie
        # para olvidarse en uno.
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

    def probar_conexion(self, cliente_id: int, password_override: Optional[str] = None) -> dict:
        """Valida credenciales y carpeta sin importar nada, sobre la casilla
        del cliente indicado.

        `password_override` permite probar una contraseña recién escrita en el
        formulario antes de guardarla.
        """
        config = self.config_repo.get_or_create(cliente_id)
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

    def revisar(self, cliente_id: int, usuario_id: int, disparo: str = "manual") -> dict:
        """Recorre la casilla DEL CLIENTE indicado e importa sus adjuntos.

        `cliente_id` dice de qué casilla leer (base principal) y `usuario_id`
        a nombre de quién queda lo importado dentro de la base del cliente.
        Devuelve un resumen y deja una fila en correo_log por cada adjunto
        evaluado, incluidos los descartados.
        """
        config = self.config_repo.get_or_create(cliente_id)
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

        # Qué reporte es, de qué RUT y de qué fecha. Por correo no hay quien lo
        # escriba: sale del contenido del archivo y, si éste no es concluyente,
        # del asunto configurado o del nombre. El tipo decide a qué parser va, y
        # los tres Excel del PJUD no son intercambiables.
        #
        # Para poder mirar el contenido hay que escribir el adjunto en disco
        # antes de clasificarlo. Si termina descartado se borra: los archivos
        # que no se importaron no tienen por qué quedar ocupando el volumen.
        # Nunca usar el nombre del correo para construir la ruta en disco.
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        destino = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
        with open(destino, "wb") as f:
            f.write(contenido)

        detectado = deteccion_archivo.detectar(nombre_original, asunto, config, destino)

        if not detectado.reconocido:
            self._borrar(destino)
            resumen["descartados"] += 1
            self._log(
                RESULTADO_DESCARTADO, message_id=message_id, remitente=remitente, asunto=asunto,
                nombre_archivo=nombre_original,
                detalle=deteccion_archivo.explicar_no_reconocido(config),
                disparo=disparo,
            )
            return

        servicio = self._servicio_para(detectado.tipo)

        # Qué le falta al archivo para poder importarse. Cada servicio declara
        # lo que necesita (ver `deduce_fecha_del_contenido` / `requiere_rut`) en
        # vez de que este método sepa qué exige cada tipo.
        if detectado.fecha is None and not servicio.deduce_fecha_del_contenido:
            falta = (
                "no se pudo determinar la fecha del reporte. No aparece ni en el "
                "nombre del archivo ni en el asunto del correo."
            )
        elif detectado.rut is None and servicio.requiere_rut:
            falta = (
                "no se pudo determinar el RUT. No aparece ni en el nombre del "
                "archivo ni en el asunto; puede indicarlo en su casilla, en el "
                "campo 'Su RUT'."
            )
        else:
            falta = None

        if falta:
            self._borrar(destino)
            resumen["descartados"] += 1
            self._log(
                RESULTADO_DESCARTADO, message_id=message_id, remitente=remitente, asunto=asunto,
                nombre_archivo=nombre_original,
                detalle=f"Se identificó como {detectado.etiqueta}, pero {falta}",
                disparo=disparo,
            )
            return

        try:
            resultado = servicio.import_file(
                destino, detectado.rut, detectado.fecha, usuario_id, nombre_original
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

        # La discrepancia se anota aunque la importación haya salido bien: es el
        # síntoma de una casilla con el asunto mal configurado, y si no queda
        # escrito nadie se entera hasta que el contenido deje de ser concluyente
        # y el archivo se vaya al parser equivocado.
        aviso = ""
        if detectado.tipo_descartado:
            etiqueta_descartada = deteccion_archivo.ETIQUETAS.get(
                detectado.tipo_descartado, detectado.tipo_descartado
            )
            aviso = (
                f". OJO: por el asunto o el nombre parecía {etiqueta_descartada}; "
                f"mandó el contenido del archivo. Revise los asuntos configurados."
            )

        resumen["importados"] += 1
        self._log(
            RESULTADO_IMPORTADO, message_id=message_id, remitente=remitente, asunto=asunto,
            nombre_archivo=nombre_original,
            detalle=(
                f"{detectado.etiqueta.capitalize()} (por {detectado.origen_tipo}), "
                f"RUT {detectado.rut or 'sin RUT'}, "
                f"fecha {resultado.get('fecha') or detectado.fecha}{aviso}"
            ),
            origen_id=resultado.get("origen_id"),
            movimientos=resultado.get("movimientos_importados"),
            disparo=disparo,
        )

    @staticmethod
    def _borrar(ruta: str) -> None:
        """Borra un adjunto que no se va a importar. Que falle no es motivo
        para perder el mensaje de descarte, que es lo que el usuario necesita."""
        try:
            os.remove(ruta)
        except OSError:
            logger.warning("No se pudo borrar el adjunto descartado %s", ruta)

    def _servicio_para(self, tipo: str):
        """Servicio de importación ya instanciado para el tipo detectado.

        Import local para no crear un ciclo: los servicios de importación no
        dependen de éste, pero sí al revés.
        """
        from app.models.estado_diario_origen import EstadoDiarioOrigen
        from app.services.audiencia_import_service import AudienciaImportService
        from app.services.movimiento_import_service import MovimientoImportService

        if tipo == EstadoDiarioOrigen.TIPO_MOVIMIENTOS:
            return MovimientoImportService(self.db)
        if tipo == EstadoDiarioOrigen.TIPO_AUDIENCIAS:
            return AudienciaImportService(self.db)
        return ImportService(self.db)

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
