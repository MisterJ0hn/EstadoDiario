"""Tests del ruteo del webhook de Twilio: de qué cliente es cada mensaje.

El webhook `/api/v1/estado-diario/request-tw` es público —quien llama es Twilio,
que no manda ningún token— así que no puede sacar el tenant de un JWT como el
resto del backend. Lo resuelve por el SID del mensaje, y de eso se tratan estos
tests: que el SID se anote al enviar, y que al volver se traduzca al cliente
correcto.

No tocan PostgreSQL: las sesiones y el cliente de Twilio van simulados. Lo que
se prueba es la decisión de a qué base ir, no que SQLAlchemy sepa escribir.
"""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.core.crypto import cifrar
from app.models.maestra.whatsapp_envio import WhatsappEnvio
from app.services import twilio_webhook_service
from app.services.whatsapp_service import WhatsappService

CLIENTE_ID = 7
SID = "SM0123456789abcdef"


def _config_activa():
    return SimpleNamespace(
        activo=True,
        twilio_account_sid="ACxxxx",
        twilio_auth_token_cifrado=cifrar("auth-token"),
        twilio_numero_whatsapp="+14155238886",
        plantilla_content_sid="HXxxxx",
        validar_firma_webhook=True,
    )


def _agenda_pendiente():
    return SimpleNamespace(
        id=42,
        whatsapp_telefono="+56911111111",
        detalle="revisar el escrito",
        estado_diario=SimpleNamespace(id=99, rol="C-1234-2026"),
        enviado=False,
        fecha_envio=None,
        twilio_sid=None,
        mensaje_error="algo previo",
    )


# ── Al enviar: queda anotado de quién es el mensaje ───────


def test_al_enviar_se_anota_el_sid_contra_su_cliente():
    """Sin esta fila el webhook no tendría de dónde sacar el tenant.

    Es el único momento en que el sistema sabe, a la vez, el SID que Twilio
    acaba de asignar y de qué cliente es la base que se está recorriendo.
    """
    agenda = _agenda_pendiente()
    db, db_maestra = MagicMock(), MagicMock()

    servicio = WhatsappService(db, db_maestra, CLIENTE_ID)
    servicio.config_repo = MagicMock()
    servicio.config_repo.get_or_create.return_value = _config_activa()
    servicio.agenda_repo = MagicMock()
    servicio.agenda_repo.find_pendientes_whatsapp.return_value = [agenda]

    with patch("twilio.rest.Client") as Client:
        Client.return_value.messages.create.return_value = SimpleNamespace(sid=SID)
        resultado = servicio.enviar_pendientes()

    assert resultado["enviados"] == 1
    assert agenda.twilio_sid == SID

    anotados = [
        fila
        for (fila,), _ in db_maestra.add.call_args_list
        if isinstance(fila, WhatsappEnvio)
    ]
    assert len(anotados) == 1, "el envío no quedó anotado en la base principal"
    assert anotados[0].twilio_sid == SID
    assert anotados[0].cliente_id == CLIENTE_ID
    assert anotados[0].agenda_id == agenda.id
    db_maestra.commit.assert_called_once()


def test_si_falla_anotar_el_indice_el_envio_no_se_reporta_como_fallido():
    """El mensaje ya salió: marcar la corrida como fallida haría que el job
    reintentara y el abogado recibiera el recordatorio dos veces. El hueco lo
    cubre el respaldo por recorrido del webhook."""
    agenda = _agenda_pendiente()
    db, db_maestra = MagicMock(), MagicMock()
    db_maestra.commit.side_effect = RuntimeError("base principal caída")

    servicio = WhatsappService(db, db_maestra, CLIENTE_ID)
    servicio.config_repo = MagicMock()
    servicio.config_repo.get_or_create.return_value = _config_activa()
    servicio.agenda_repo = MagicMock()
    servicio.agenda_repo.find_pendientes_whatsapp.return_value = [agenda]

    with patch("twilio.rest.Client") as Client:
        Client.return_value.messages.create.return_value = SimpleNamespace(sid=SID)
        resultado = servicio.enviar_pendientes()

    assert resultado["exito"] is True
    assert resultado["enviados"] == 1
    db_maestra.rollback.assert_called_once()


# ── Al volver: el SID se traduce al cliente correcto ──────


def test_el_sid_anotado_resuelve_su_cliente_sin_recorrer_nada():
    """El camino normal: una consulta a la base principal y listo."""
    db_maestra = MagicMock()
    consulta = db_maestra.query.return_value.filter.return_value.order_by.return_value
    consulta.first.return_value = WhatsappEnvio(
        twilio_sid=SID, cliente_id=CLIENTE_ID, fecha_envio=datetime.now(timezone.utc)
    )

    with patch.object(twilio_webhook_service, "ClienteRepository") as Repo:
        Repo.return_value.find_by_id.return_value = SimpleNamespace(guid="guid-del-7")
        with patch.object(twilio_webhook_service, "_buscar_recorriendo_clientes") as recorrido:
            guid = twilio_webhook_service._resolver_cliente(db_maestra, SID)

    assert guid == "guid-del-7"
    recorrido.assert_not_called()


def test_un_sid_sin_anotar_se_busca_recorriendo_los_clientes():
    """Los mensajes enviados antes de que existiera `whatsapp_envio` tienen que
    seguir funcionando; si no, el botón deja de responder justo para los
    recordatorios más viejos, que son los que más se contestan tarde."""
    db_maestra = MagicMock()
    db_maestra.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

    with patch.object(twilio_webhook_service, "_buscar_recorriendo_clientes") as recorrido:
        recorrido.return_value = "guid-encontrado"
        guid = twilio_webhook_service._resolver_cliente(db_maestra, SID)

    assert guid == "guid-encontrado"
    recorrido.assert_called_once_with(db_maestra, SID)


def test_el_recorrido_anota_el_sid_que_encontro():
    """Para que cada mensaje viejo pague el recorrido una sola vez."""
    cliente = SimpleNamespace(
        cliente_id=CLIENTE_ID, guid="guid-del-7", estado_aprovisionamiento="listo"
    )
    db_maestra = MagicMock()

    with patch.object(twilio_webhook_service, "ClienteRepository") as Repo, \
            patch.object(twilio_webhook_service, "sesion_tenant"), \
            patch.object(twilio_webhook_service, "EstadoDiarioAgendaRepository") as AgendaRepo:
        Repo.return_value.find_activos.return_value = [cliente]
        AgendaRepo.return_value.find_by_twilio_sid.return_value = SimpleNamespace(id=42)
        guid = twilio_webhook_service._buscar_recorriendo_clientes(db_maestra, SID)

    assert guid == "guid-del-7"
    anotados = [
        fila
        for (fila,), _ in db_maestra.add.call_args_list
        if isinstance(fila, WhatsappEnvio)
    ]
    assert len(anotados) == 1
    assert anotados[0].twilio_sid == SID
    assert anotados[0].cliente_id == CLIENTE_ID


def test_un_cliente_a_medio_aprovisionar_no_se_consulta():
    """Su base puede ni existir: abrirla sería un error de conexión por cada
    callback, y encima de un cliente que no tiene nada que ver."""
    cliente = SimpleNamespace(
        cliente_id=3, guid="guid-a-medias", estado_aprovisionamiento="creando"
    )
    db_maestra = MagicMock()

    with patch.object(twilio_webhook_service, "ClienteRepository") as Repo, \
            patch.object(twilio_webhook_service, "sesion_tenant") as sesion:
        Repo.return_value.find_activos.return_value = [cliente]
        guid = twilio_webhook_service._buscar_recorriendo_clientes(db_maestra, SID)

    assert guid is None
    sesion.assert_not_called()


def test_una_base_caida_no_corta_la_busqueda_en_los_demas():
    """El callback puede ser de otro estudio; que uno esté caído no es motivo
    para dejarlo sin respuesta."""
    caido = SimpleNamespace(cliente_id=1, guid="guid-caido", estado_aprovisionamiento="listo")
    bueno = SimpleNamespace(cliente_id=2, guid="guid-bueno", estado_aprovisionamiento="listo")
    db_maestra = MagicMock()

    def abrir(guid):
        if guid == "guid-caido":
            raise RuntimeError("no se pudo conectar")
        return MagicMock()

    with patch.object(twilio_webhook_service, "ClienteRepository") as Repo, \
            patch.object(twilio_webhook_service, "sesion_tenant", side_effect=abrir), \
            patch.object(twilio_webhook_service, "EstadoDiarioAgendaRepository") as AgendaRepo:
        Repo.return_value.find_activos.return_value = [caido, bueno]
        AgendaRepo.return_value.find_by_twilio_sid.return_value = SimpleNamespace(id=42)
        guid = twilio_webhook_service._buscar_recorriendo_clientes(db_maestra, SID)

    assert guid == "guid-bueno"
