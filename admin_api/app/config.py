"""Ajustes propios de `admin_api`.

Todo lo compartido con el backend de los estudios —base de datos, prefijo de
tenant, clave de firma, claves de cifrado, zona horaria— sale de
`app.core.config.settings` y NO se redefine acá: son los mismos valores o el
cifrado deja de cuadrar entre los dos servicios.

Lo que sí es propio son las dos cosas que separan a un servicio de otro: el
puerto en el que escucha y los orígenes desde los que el navegador puede
llamarlo. Cuando la consola era un solo proceso con su SPA, ninguna de las dos
existía.
"""

from typing import List

from pydantic_settings import BaseSettings


class AdminApiSettings(BaseSettings):
    # 8091 es del backend de los estudios y 8090 del frontend: este servicio va
    # aparte para poder desplegarlo y reiniciarlo sin tocarlos.
    ADMIN_API_PORT: int = 8092

    # Origen de la SPA de administración (`admin_app/`). Al publicarse, esta
    # lista y `environment.prod.ts` de la SPA se cambian juntas: si no calzan,
    # el navegador bloquea el preflight y la consola queda en blanco sin un
    # error de servidor que lo explique.
    ADMIN_API_CORS_ORIGINS: str = "http://localhost:4401"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ADMIN_API_CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        case_sensitive = True
        # El .env ya lo cargó `admin_api/app/__init__.py` por ruta absoluta.
        extra = "ignore"


admin_settings = AdminApiSettings()
