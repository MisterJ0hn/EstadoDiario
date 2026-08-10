"""Cambio de contraseña con historial, para los dos tipos de cuenta.

Es la mitad de la política que necesita la base: el formato lo valida
`app/core/password_policy.py`, y acá se comprueba que la contraseña nueva no
sea ninguna de las últimas `HISTORIAL_MAXIMO` que usó la persona.

Las funciones reciben la CLASE del historial (`PasswordHistorial` para la base
de un cliente, `PasswordHistorialAdmin` para la principal) en vez de deducirla:
las dos tablas se llaman igual y viven en bases distintas, así que quien llama
—que ya sabe sobre qué sesión está trabajando— es el único que puede elegir
bien. Pasar la equivocada falla al primer query, no en silencio.

Por qué el historial vive en su propia tabla y no en cuatro columnas del
usuario: con columnas, subir o bajar el número obliga a migrar el esquema, y
las filas dejan de tener fecha. Además una tabla se poda sola.
"""

import logging
from typing import Optional, Type

from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException, UnauthorizedException
from app.core.password_policy import HISTORIAL_MAXIMO, validar
from app.core.security import get_password_hash, verify_password

logger = logging.getLogger(__name__)


def _hashes_vetados(db: Session, registro, modelo_historial: Type) -> list[str]:
    """Los hashes que la contraseña nueva no puede igualar.

    Es la clave vigente más las anteriores que queden en el historial, hasta
    completar `HISTORIAL_MAXIMO`. La vigente se antepone porque una cuenta
    anterior a esta funcionalidad —o creada antes de que se registrara la
    primera fila— no tiene historial y su clave actual igual tiene que estar
    vetada.

    Se descartan los repetidos por si la vigente ya está guardada como la fila
    más nueva, que es el caso normal: sin esto, esa fila ocuparía un lugar de
    los cuatro y quedarían vetadas cinco contraseñas.
    """
    filas = (
        db.query(modelo_historial)
        .filter(modelo_historial.usuario_id == registro.id)
        .order_by(modelo_historial.id.desc())
        .limit(HISTORIAL_MAXIMO)
        .all()
    )

    vetados: list[str] = []
    for hash_ in [registro.password_hash, *(f.password_hash for f in filas)]:
        if hash_ and hash_ not in vetados:
            vetados.append(hash_)
    return vetados[:HISTORIAL_MAXIMO]


def validar_nueva(db: Session, registro, password: str, modelo_historial: Type) -> None:
    """Formato + historial. `registro` en None es una cuenta que todavía no
    existe (alta de usuario): ahí solo hay formato que validar."""
    validar(password)

    if registro is None or registro.id is None:
        return

    vetados = _hashes_vetados(db, registro, modelo_historial)
    for indice, hash_ in enumerate(vetados):
        if verify_password(password, hash_):
            if indice == 0:
                raise BadRequestException(
                    "La contraseña nueva debe ser distinta de la actual"
                )
            raise BadRequestException(
                f"No puede reutilizar ninguna de sus últimas {HISTORIAL_MAXIMO} "
                f"contraseñas. Elija una que no haya usado antes."
            )


def registrar(db: Session, usuario_id: int, password_hash: str, modelo_historial: Type) -> None:
    """Anota el hash en el historial y poda lo que ya no veta nada.

    No hace commit: lo hace quien está aplicando el cambio, para que la clave
    nueva y su fila del historial entren o no entren juntas.
    """
    db.add(modelo_historial(usuario_id=usuario_id, password_hash=password_hash))
    db.flush()

    sobrantes = (
        db.query(modelo_historial)
        .filter(modelo_historial.usuario_id == usuario_id)
        .order_by(modelo_historial.id.desc())
        .offset(HISTORIAL_MAXIMO)
        .all()
    )
    for fila in sobrantes:
        db.delete(fila)


def aplicar(
    db: Session,
    registro,
    password: str,
    modelo_historial: Type,
    *,
    provisoria: bool = False,
    password_actual: Optional[str] = None,
    exigir_actual: bool = False,
) -> None:
    """Valida y deja la contraseña nueva puesta, con su fila de historial.

    `exigir_actual` es el cambio voluntario: sin la clave de ahora, una sesión
    olvidada abierta en un computador ajeno alcanzaría para quedarse con la
    cuenta. No se pide cuando la clave era provisoria (la persona acaba de
    escribirla para entrar) ni cuando el cambio viene de un enlace de
    recuperación validado por correo.

    `provisoria` la ponen los cambios hechos POR UN TERCERO —el administrador
    de la plataforma creando o reseteando una cuenta—: la clave la escribió
    otro, así que hay que cambiarla al entrar.
    """
    if exigir_actual:
        if not password_actual:
            raise BadRequestException("Debe indicar su contraseña actual")
        if not verify_password(password_actual, registro.password_hash):
            # 401 y no 400: es una credencial que no calza, no un dato mal
            # formado. El llamador lo traduce igual para el usuario.
            raise UnauthorizedException("La contraseña actual no es correcta")

    validar_nueva(db, registro, password, modelo_historial)

    registro.password_hash = get_password_hash(password)
    registro.debe_cambiar_password = provisoria
    registrar(db, registro.id, registro.password_hash, modelo_historial)
    db.commit()
