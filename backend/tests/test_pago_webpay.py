"""Pago de una factura con Webpay Plus.

No sale nada a la red: se intercepta `app.core.transbank` y se le devuelven las
respuestas que da Transbank de verdad. La base es SQLite en memoria, con las
tablas de la base principal que intervienen.

**Por qué hay tantos casos para tres llamadas HTTP.** Casi todo lo que puede
salir mal acá no se nota mirando la pantalla: una factura que se marca pagada
con un cargo por otro monto se ve igual que una bien pagada, y un cliente que
recupera el acceso porque pagó se ve igual que uno que lo recuperó porque una
regla lo reactivó por error. Los casos de abajo son, uno a uno, formas de
regalar plata o de deshacer una decisión que nadie tomó.
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.maestra.cliente import Cliente
from app.models.maestra.cliente_estado_historial import ClienteEstadoHistorial
from app.models.maestra.configuracion_transbank import ConfiguracionTransbank
from app.models.maestra.factura import Factura, FacturaDetalle
from app.models.maestra.pago import Pago
from app.services import pago_service as modulo_pago
from app.services.pago_service import (
    RESULTADO_ANULADO,
    RESULTADO_ERROR,
    RESULTADO_EXITO,
    RESULTADO_RECHAZADO,
    PagoService,
)

RETORNO = "https://ed.temposoft.cl/api/v1/pagos/webpay/retorno"


# ── Andamiaje ─────────────────────────────────────────────


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    tablas = [
        Cliente.__table__,
        # Reactivar por pago deja su línea acá, así que la tabla tiene que
        # existir aunque estas pruebas no la miren: sin ella el pago falla con
        # un "no such table" en medio del commit.
        ClienteEstadoHistorial.__table__,
        Factura.__table__,
        FacturaDetalle.__table__,
        Pago.__table__,
        ConfiguracionTransbank.__table__,
    ]
    Cliente.metadata.create_all(engine, tables=tablas)
    sesion = sessionmaker(bind=engine)()
    try:
        yield sesion
    finally:
        sesion.close()


@pytest.fixture
def encendido(db):
    """Webpay activo, en integración."""
    db.add(ConfiguracionTransbank(activo=True, ambiente="integracion"))
    db.commit()


def _cliente(
    db, activo=True, suspendido_por_mora=False, nombre="Estudio X", rut="76543210-K"
) -> Cliente:
    """Un cliente mínimo pero válido.

    El RUT se asigna por la propiedad, no por la columna: `Cliente.rut` cifra y
    además calcula el `rut_hash` por donde se busca. El guid y el nombre de la
    base son NOT NULL y únicos, así que se derivan del RUT para que dos
    clientes de una misma prueba no choquen.
    """
    cliente = Cliente(nombre=nombre, activo=activo, suspendido_por_mora=suspendido_por_mora)
    cliente.rut = rut
    cliente.guid = f"guid-{rut}"
    cliente.base_datos = f"estado_diario_{rut.lower().replace('-', '')}"
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


def _factura(db, cliente, numero=42, total="10500.00", estado=Factura.ESTADO_EMITIDA,
             anulada=False) -> Factura:
    factura = Factura(
        numero=numero,
        cliente_id=cliente.cliente_id,
        fecha_desde=datetime(2026, 7, 1).date(),
        fecha_hasta=datetime(2026, 7, 31).date(),
        razon_social=cliente.nombre,
        rut="76543210-K",
        total=Decimal(total),
        estado=estado,
        anulada=anulada,
    )
    db.add(factura)
    db.commit()
    db.refresh(factura)
    return factura


def _respuesta_aprobada(monto=10500, orden="F000042-1"):
    """Lo que devuelve Transbank al confirmar una transacción aprobada."""
    return {
        "vci": "TSY",
        "amount": monto,
        "status": "AUTHORIZED",
        "buy_order": orden,
        "session_id": "C1-1",
        "card_detail": {"card_number": "6623"},
        "accounting_date": "0812",
        "transaction_date": "2026-08-12T13:40:00.000Z",
        "authorization_code": "1213",
        "payment_type_code": "VN",
        "response_code": 0,
        "installments_number": 0,
    }


def _iniciar(db, factura, cliente, token="tok-1"):
    """Inicia un pago con Transbank interceptado y devuelve el resultado."""
    with patch.object(
        modulo_pago.transbank,
        "crear_transaccion",
        return_value={"token": token, "url": "https://webpay3gint.transbank.cl/pago"},
    ) as crear:
        datos = PagoService(db).iniciar(
            factura.id, cliente.cliente_id, usuario_id=7, return_url=RETORNO
        )
    return datos, crear


# ── Orden de las rutas ────────────────────────────────────


def test_el_retorno_se_declara_antes_que_la_ruta_con_parametro():
    """`/webpay/retorno` tiene que ganarle a `/webpay/{factura_id}`.

    FastAPI resuelve por orden de declaración. Al revés, el POST que manda
    Transbank entra por la ruta con parámetro —con `factura_id = "retorno"`—,
    que exige sesión, y el navegador que vuelve de Webpay no lleva el Bearer:
    responde 403, el pago nunca se confirma y la transacción se reversa a los
    10 minutos. La factura queda impaga sin un solo error en el log.

    Pasó de verdad al escribir esto, y no se ve en ninguna prueba de unidad.
    """
    from app.api.v1.endpoints.pagos import router

    rutas = [r.path for r in router.routes]

    assert rutas.index("/pagos/webpay/retorno") < rutas.index("/pagos/webpay/{factura_id}")


# ── Iniciar: lo que no se puede cobrar ────────────────────


def test_una_factura_anulada_no_se_puede_pagar(db, encendido):
    cliente = _cliente(db)
    factura = _factura(db, cliente, anulada=True, estado=Factura.ESTADO_ANULADA)

    with pytest.raises(BadRequestException):
        PagoService(db).iniciar(factura.id, cliente.cliente_id, 7, RETORNO)


def test_una_factura_ya_pagada_no_se_puede_pagar_de_nuevo(db, encendido):
    cliente = _cliente(db)
    factura = _factura(db, cliente, estado=Factura.ESTADO_PAGADA)

    with pytest.raises(BadRequestException):
        PagoService(db).iniciar(factura.id, cliente.cliente_id, 7, RETORNO)


def test_una_factura_con_pago_aprobado_no_se_cobra_dos_veces(db, encendido):
    # La factura quedó sin marcar pero el pago existe: es un estado que hay que
    # mirar, no una invitación a cobrar de nuevo.
    cliente = _cliente(db)
    factura = _factura(db, cliente)
    db.add(
        Pago(
            factura_id=factura.id,
            cliente_id=cliente.cliente_id,
            buy_order="F000042-1",
            monto=Decimal("10500"),
            estado=Pago.ESTADO_APROBADO,
        )
    )
    db.commit()

    with pytest.raises(BadRequestException):
        PagoService(db).iniciar(factura.id, cliente.cliente_id, 7, RETORNO)


def test_la_factura_de_otro_estudio_responde_404_y_no_403(db, encendido):
    # 403 confirmaría que ese id existe. Es el mismo criterio del listado de
    # facturas del estudio.
    propio = _cliente(db, nombre="Estudio Propio")
    ajeno = _cliente(db, nombre="Estudio Ajeno", rut="11111111-1")
    factura_ajena = _factura(db, ajeno, numero=99)

    with pytest.raises(NotFoundException):
        PagoService(db).iniciar(factura_ajena.id, propio.cliente_id, 7, RETORNO)


def test_una_factura_en_cero_no_se_manda_a_webpay(db, encendido):
    cliente = _cliente(db)
    factura = _factura(db, cliente, total="0.00")

    with pytest.raises(BadRequestException):
        PagoService(db).iniciar(factura.id, cliente.cliente_id, 7, RETORNO)


def test_con_webpay_apagado_no_se_puede_iniciar(db):
    # Sin la fixture `encendido`: la configuración nace apagada.
    cliente = _cliente(db)
    factura = _factura(db, cliente)

    with pytest.raises(BadRequestException):
        PagoService(db).iniciar(factura.id, cliente.cliente_id, 7, RETORNO)


# ── Iniciar: lo que se le manda a Transbank ───────────────


def test_el_monto_va_entero(db, encendido):
    # En CLP Webpay no acepta decimales y el total es NUMERIC(14,2).
    cliente = _cliente(db)
    factura = _factura(db, cliente, total="10500.00")

    datos, crear = _iniciar(db, factura, cliente)

    assert crear.call_args.kwargs["monto"] == 10500
    assert isinstance(crear.call_args.kwargs["monto"], int)
    assert datos["monto"] == 10500


def test_la_orden_de_compra_lleva_factura_e_intento_y_cabe_en_26(db, encendido):
    cliente = _cliente(db)
    factura = _factura(db, cliente, numero=42)

    datos, _ = _iniciar(db, factura, cliente)

    assert datos["buy_order"].startswith("F000042-")
    assert len(datos["buy_order"]) <= 26


def test_reintentar_no_reusa_la_orden_de_compra(db, encendido):
    cliente = _cliente(db)
    factura = _factura(db, cliente)

    primero, _ = _iniciar(db, factura, cliente, token="tok-1")
    # El primero quedó rechazado y el estudio prueba con otra tarjeta.
    pago = db.get(Pago, primero["pago_id"])
    pago.cerrar(Pago.ESTADO_RECHAZADO, "rechazado")
    db.commit()

    segundo, _ = _iniciar(db, factura, cliente, token="tok-2")

    assert segundo["buy_order"] != primero["buy_order"]


def test_si_transbank_falla_el_intento_queda_registrado(db, encendido):
    # "Transbank estaba caído a las 15:40" y "no pasó nada" no son lo mismo.
    cliente = _cliente(db)
    factura = _factura(db, cliente)

    with patch.object(
        modulo_pago.transbank,
        "crear_transaccion",
        side_effect=modulo_pago.transbank.ErrorTransbank("timeout"),
    ):
        with pytest.raises(HTTPException) as exc:
            PagoService(db).iniciar(factura.id, cliente.cliente_id, 7, RETORNO)

    assert exc.value.status_code == 502
    pago = db.query(Pago).one()
    assert pago.estado == Pago.ESTADO_ERROR
    assert pago.fecha_cierre is not None


# ── Confirmación ──────────────────────────────────────────


def test_una_confirmacion_aprobada_marca_la_factura_pagada(db, encendido):
    cliente = _cliente(db)
    factura = _factura(db, cliente)
    datos, _ = _iniciar(db, factura, cliente)

    with patch.object(
        modulo_pago.transbank, "confirmar", return_value=_respuesta_aprobada()
    ):
        resultado = PagoService(db).confirmar_retorno(token_ws=datos["token"])

    assert resultado.resultado == RESULTADO_EXITO
    db.refresh(factura)
    assert factura.estado == Factura.ESTADO_PAGADA

    pago = db.get(Pago, datos["pago_id"])
    assert pago.estado == Pago.ESTADO_APROBADO
    assert pago.authorization_code == "1213"
    assert pago.tarjeta_final4 == "6623"
    # La respuesta completa queda guardada: al cuadrar con el cierre diario de
    # Transbank ya no se puede volver a pedir.
    assert pago.respuesta_cruda and "TSY" in pago.respuesta_cruda


def test_volver_a_confirmar_no_llama_de_nuevo_a_transbank(db, encendido):
    # El commit se puede hacer UNA sola vez por token: la segunda Transbank la
    # rechaza. Un F5 en la pantalla de retorno no puede convertir un pago bueno
    # en un error.
    cliente = _cliente(db)
    factura = _factura(db, cliente)
    datos, _ = _iniciar(db, factura, cliente)

    with patch.object(
        modulo_pago.transbank, "confirmar", return_value=_respuesta_aprobada()
    ):
        PagoService(db).confirmar_retorno(token_ws=datos["token"])

    with patch.object(modulo_pago.transbank, "confirmar") as confirmar:
        segundo = PagoService(db).confirmar_retorno(token_ws=datos["token"])

    confirmar.assert_not_called()
    assert segundo.resultado == RESULTADO_EXITO


def test_un_monto_que_no_calza_no_marca_la_factura(db, encendido):
    # Dar por pagada una factura de $10.500 con un cargo de $2.000 es peor que
    # no cobrar: queda en `error` para que lo mire una persona.
    cliente = _cliente(db)
    factura = _factura(db, cliente, total="10500.00")
    datos, _ = _iniciar(db, factura, cliente)

    with patch.object(
        modulo_pago.transbank,
        "confirmar",
        return_value=_respuesta_aprobada(monto=2000),
    ):
        resultado = PagoService(db).confirmar_retorno(token_ws=datos["token"])

    assert resultado.resultado == RESULTADO_ERROR
    db.refresh(factura)
    assert factura.estado == Factura.ESTADO_EMITIDA
    assert db.get(Pago, datos["pago_id"]).estado == Pago.ESTADO_ERROR


def test_un_rechazo_de_la_tarjeta_no_marca_la_factura(db, encendido):
    cliente = _cliente(db)
    factura = _factura(db, cliente)
    datos, _ = _iniciar(db, factura, cliente)

    rechazo = _respuesta_aprobada()
    rechazo.update({"response_code": -1, "status": "FAILED", "authorization_code": None})

    with patch.object(modulo_pago.transbank, "confirmar", return_value=rechazo):
        resultado = PagoService(db).confirmar_retorno(token_ws=datos["token"])

    assert resultado.resultado == RESULTADO_RECHAZADO
    db.refresh(factura)
    assert factura.estado == Factura.ESTADO_EMITIDA
    assert db.get(Pago, datos["pago_id"]).estado == Pago.ESTADO_RECHAZADO


def test_autorizada_pero_con_status_raro_no_se_da_por_pagada(db, encendido):
    # Se exigen las dos cosas: response_code 0 y status AUTHORIZED.
    cliente = _cliente(db)
    factura = _factura(db, cliente)
    datos, _ = _iniciar(db, factura, cliente)

    ambiguo = _respuesta_aprobada()
    ambiguo["status"] = "REVERSED"

    with patch.object(modulo_pago.transbank, "confirmar", return_value=ambiguo):
        resultado = PagoService(db).confirmar_retorno(token_ws=datos["token"])

    assert resultado.resultado == RESULTADO_RECHAZADO
    db.refresh(factura)
    assert factura.estado == Factura.ESTADO_EMITIDA


def test_si_falla_la_confirmacion_no_se_marca_nada(db, encendido):
    # Acá no se sabe si se cobró: se resuelve consultando el estado, nunca
    # reintentando el commit.
    cliente = _cliente(db)
    factura = _factura(db, cliente)
    datos, _ = _iniciar(db, factura, cliente)

    with patch.object(
        modulo_pago.transbank,
        "confirmar",
        side_effect=modulo_pago.transbank.ErrorTransbank("se cortó"),
    ):
        resultado = PagoService(db).confirmar_retorno(token_ws=datos["token"])

    assert resultado.resultado == RESULTADO_ERROR
    db.refresh(factura)
    assert factura.estado == Factura.ESTADO_EMITIDA
    assert db.get(Pago, datos["pago_id"]).estado == Pago.ESTADO_ERROR


def test_un_token_desconocido_no_confirma_nada(db, encendido):
    with patch.object(modulo_pago.transbank, "confirmar") as confirmar:
        resultado = PagoService(db).confirmar_retorno(token_ws="token-inventado")

    confirmar.assert_not_called()
    assert resultado.resultado == RESULTADO_ERROR


# ── Los finales que no son un pago ────────────────────────


def test_el_usuario_que_anula_cierra_el_intento(db, encendido):
    cliente = _cliente(db)
    factura = _factura(db, cliente)
    datos, _ = _iniciar(db, factura, cliente)

    resultado = PagoService(db).confirmar_retorno(
        tbk_token=datos["token"], tbk_orden_compra=datos["buy_order"]
    )

    assert resultado.resultado == RESULTADO_ANULADO
    assert db.get(Pago, datos["pago_id"]).estado == Pago.ESTADO_ANULADO
    db.refresh(factura)
    assert factura.estado == Factura.ESTADO_EMITIDA


def test_el_timeout_del_formulario_se_ubica_por_la_orden_de_compra(db, encendido):
    # Transbank devuelve sin ningún token: la orden es lo único que hay.
    cliente = _cliente(db)
    factura = _factura(db, cliente)
    datos, _ = _iniciar(db, factura, cliente)

    resultado = PagoService(db).confirmar_retorno(
        tbk_orden_compra=datos["buy_order"]
    )

    assert resultado.resultado == RESULTADO_ANULADO
    assert db.get(Pago, datos["pago_id"]).estado == Pago.ESTADO_ANULADO


# ── Reactivación por mora ─────────────────────────────────


def _pagar(db, factura, cliente):
    datos, _ = _iniciar(db, factura, cliente, token=f"tok-{factura.id}")
    with patch.object(
        modulo_pago.transbank,
        "confirmar",
        return_value=_respuesta_aprobada(
            monto=int(Decimal(factura.total)), orden=datos["buy_order"]
        ),
    ):
        return PagoService(db).confirmar_retorno(token_ws=datos["token"])


def test_el_suspendido_por_mora_se_reactiva_al_quedar_sin_deuda(db, encendido):
    cliente = _cliente(db, activo=False, suspendido_por_mora=True)
    factura = _factura(db, cliente)

    resultado = _pagar(db, factura, cliente)

    assert resultado.reactivado is True
    db.refresh(cliente)
    assert cliente.activo is True
    # La marca se limpia: si el job vuelve a suspenderlo, la escribirá de nuevo.
    assert cliente.suspendido_por_mora is False


def test_la_reactivacion_por_pago_queda_en_el_historial(db, encendido):
    """De esa tabla sale la serie mensual del dashboard de la consola.

    Sin esta línea el cliente se dibujaría suspendido para siempre aunque haya
    vuelto a operar: es la costura entre el pago en línea y el gráfico, y no la
    cubre ninguna de las dos funcionalidades por separado.
    """
    cliente = _cliente(db, activo=False, suspendido_por_mora=True)
    factura = _factura(db, cliente)

    _pagar(db, factura, cliente)

    ultima = (
        db.query(ClienteEstadoHistorial)
        .order_by(ClienteEstadoHistorial.id.desc())
        .first()
    )
    assert ultima is not None
    assert ultima.cliente_id == cliente.cliente_id
    assert ultima.estado == ClienteEstadoHistorial.ESTADO_ACTIVO
    assert ultima.motivo == ClienteEstadoHistorial.MOTIVO_PAGO


def test_el_pago_que_no_reactiva_no_escribe_historial(db, encendido):
    # Un cliente que ya estaba activo paga: no hubo transición, así que no hay
    # nada que registrar. Escribir igual llenaría la serie de puntos falsos.
    cliente = _cliente(db, activo=True)
    factura = _factura(db, cliente)

    _pagar(db, factura, cliente)

    assert db.query(ClienteEstadoHistorial).count() == 0


def test_el_desactivado_a_mano_no_se_reactiva_al_pagar(db, encendido):
    # El caso que justifica la columna `suspendido_por_mora`: en la base las dos
    # suspensiones son el mismo `activo = False`, y sin la marca pagar una
    # factura le devolvería el acceso a quien fue dado de baja por otro motivo.
    cliente = _cliente(db, activo=False, suspendido_por_mora=False)
    factura = _factura(db, cliente)

    resultado = _pagar(db, factura, cliente)

    assert resultado.resultado == RESULTADO_EXITO
    assert resultado.reactivado is False
    db.refresh(cliente)
    assert cliente.activo is False


def test_no_se_reactiva_si_le_quedan_facturas_impagas(db, encendido):
    # Pagar la más nueva y seguir debiendo dos no es estar al día.
    cliente = _cliente(db, activo=False, suspendido_por_mora=True)
    vieja = _factura(db, cliente, numero=40)
    nueva = _factura(db, cliente, numero=41)

    resultado = _pagar(db, nueva, cliente)

    assert resultado.reactivado is False
    db.refresh(cliente)
    assert cliente.activo is False
    # La que se pagó sí quedó pagada.
    db.refresh(nueva)
    assert nueva.estado == Factura.ESTADO_PAGADA
    db.refresh(vieja)
    assert vieja.estado == Factura.ESTADO_EMITIDA


def test_una_factura_anulada_no_cuenta_como_deuda_pendiente(db, encendido):
    cliente = _cliente(db, activo=False, suspendido_por_mora=True)
    anulada = _factura(db, cliente, numero=40, anulada=True, estado=Factura.ESTADO_ANULADA)
    nueva = _factura(db, cliente, numero=41)

    resultado = _pagar(db, nueva, cliente)

    assert resultado.reactivado is True
    assert anulada.estado == Factura.ESTADO_ANULADA


def test_el_cliente_activo_no_se_toca(db, encendido):
    cliente = _cliente(db, activo=True)
    factura = _factura(db, cliente)

    resultado = _pagar(db, factura, cliente)

    assert resultado.reactivado is False
    db.refresh(cliente)
    assert cliente.activo is True


# ── Fecha de la transacción ───────────────────────────────


def test_una_fecha_ilegible_no_tumba_un_pago_bueno(db, encendido):
    cliente = _cliente(db)
    factura = _factura(db, cliente)
    datos, _ = _iniciar(db, factura, cliente)

    respuesta = _respuesta_aprobada()
    respuesta["transaction_date"] = "ayer por la tarde"

    with patch.object(modulo_pago.transbank, "confirmar", return_value=respuesta):
        resultado = PagoService(db).confirmar_retorno(token_ws=datos["token"])

    assert resultado.resultado == RESULTADO_EXITO
    assert db.get(Pago, datos["pago_id"]).fecha_transaccion is None


def test_la_z_de_transbank_se_interpreta_como_utc():
    # Transbank manda `2026-08-12T13:40:00.000Z` y `fromisoformat` no entiende
    # la Z antes de Python 3.11: sin la conversión, la hora se leería mal o no
    # se leería. Se prueba la función y no la columna porque SQLite no conserva
    # el desplazamiento horario; en PostgreSQL la columna es TIMESTAMPTZ.
    leida = modulo_pago._fecha("2026-08-12T13:40:00.000Z")

    assert leida is not None
    assert leida.tzinfo is not None
    assert leida.astimezone(timezone.utc).hour == 13


def test_la_fecha_de_transbank_queda_guardada_en_el_pago(db, encendido):
    cliente = _cliente(db)
    factura = _factura(db, cliente)
    datos, _ = _iniciar(db, factura, cliente)

    with patch.object(
        modulo_pago.transbank, "confirmar", return_value=_respuesta_aprobada()
    ):
        PagoService(db).confirmar_retorno(token_ws=datos["token"])

    guardada = db.get(Pago, datos["pago_id"]).fecha_transaccion
    assert guardada is not None
    # La hora de Transbank, no la del servidor: son distintas y la que vale
    # para un reclamo es la de ellos.
    assert (guardada.hour, guardada.minute) == (13, 40)
