# admin_api

API de administración de la plataforma multi-cliente. Servicio FastAPI aparte,
en el **puerto 8092**. Su único consumidor es la SPA `admin_app/` (Angular,
dev-server en `http://localhost:4401`).

No lo usan los estudios: ese es `backend/` (puerto 8091), y son procesos
distintos a propósito — distinto público, distinto ciclo de despliegue y
distinta superficie expuesta.

## Qué hace

| Ruta | Para qué |
|---|---|
| `POST /api/v1/auth/admin/login` | Login del administrador de la plataforma (usuario + clave) |
| `POST /api/v1/auth/refresh` | Renovar el token |
| `GET /api/v1/auth/me` | Perfil de la sesión (alias: `/auth/admin/me`) |
| `POST /api/v1/auth/cambiar-password` | Cambiar la propia clave; es la salida del estado "clave provisoria" |
| `GET/POST/PUT /api/v1/admin/clientes...` | Alta, ficha, suspensión, aprovisionamiento, casilla de ingesta y usuarios de cada cliente |
| `GET /api/v1/admin/dashboard` | KPIs de la plataforma y actividad por cliente |
| `GET/PUT /api/v1/admin/configuracion/sistema` | Política de permanencia de la bitácora, con los conteos para dimensionarla |
| `POST /api/v1/admin/configuracion/sistema/purgar-log` | Purga inmediata de la bitácora de todos los clientes |
| `GET/PUT /api/v1/configuracion-google` | Client ID/Secret de Google Cloud (global) |
| `GET/PUT /api/v1/configuracion-whatsapp` | Credenciales de Twilio (global) |
| `GET /health` | Salud del servicio |

Las respuestas de operación usan el contrato de la casa: `{"exito": bool,
"mensaje": str}`. No hay `success`/`data` en ningún lado.

## Comparte el paquete `app` de `backend/`

`admin_api` **no duplica** modelos, `core/crypto`, `core/hash_busqueda`,
`core/security`, `core/database`, `core/esquema`, repositorios ni
`aprovisionamiento_service`: los importa desde `backend/app`.

Son más de cuarenta archivos que tendrían que quedar byte a byte iguales, y la
divergencia no daría un error sino datos malos: `core/esquema` define las 14
tablas de la base de cliente (una copia atrasada crearía clientes con un esquema
que el backend no espera) y `core/crypto` deriva su clave de
`BACKEND_SECRET_KEY` (una copia que derive distinto cifra RUTs que el backend no
puede descifrar).

`admin_api/app/__init__.py` agrega `backend/` al `sys.path` antes de que se
importe nada, y comprueba que el paquete `app` haya quedado apuntando ahí.

**Consecuencia para el despliegue: la imagen tiene que incluir `backend/app`.**
No es opcional; sin ese directorio el servicio no levanta. Por eso
`admin_api/Dockerfile` se construye con la **raíz del repositorio** como
contexto y no con este directorio:

```yaml
build:
  context: .
  dockerfile: admin_api/Dockerfile
```

**Y también las dependencias del paquete compartido.** Compartir el código
implica compartir lo que ese código importa: `admin_cliente_service` usa
`app.services.correo_service`, que arrastra el importador de Excel (openpyxl,
xlrd) y el de audiencias (google-api-python-client). Por eso
`admin_api/requirements.txt` no tiene una lista propia sino
`-r ../backend/requirements.txt`: una lista recortada instalaba bien y reventaba
al arrancar, y una lista duplicada podía divergir en las versiones del mismo
código.

## Cómo se arranca

Desde la **raíz del repositorio**, no desde `admin_api/`:

```bash
uvicorn admin_api.app.main:app --host 0.0.0.0 --port 8092
```

Tiene que ser así porque este directorio también se llama `app`: parado dentro
de `admin_api/`, `app.main:app` resolvería a **este** paquete y no al compartido
de `backend/`. Si igual pasa, el servicio no falla con un `ImportError` a mitad
de camino: aborta al arrancar diciendo exactamente eso.

Equivalente con `PYTHONPATH`, si se prefiere no depender del directorio de
trabajo:

```bash
PYTHONPATH=/ruta/al/repo:/ruta/al/repo/backend uvicorn admin_api.app.main:app --port 8092
```

## Configuración

Lo compartido con el backend sale de `backend/app/core/config.py` y del `.env`
de la raíz del repositorio (que `admin_api/app/__init__.py` carga por ruta
absoluta, así que no importa desde dónde se arranque). Las variables del entorno
ya definidas mandan sobre el archivo.

| Variable | Por defecto | Para qué |
|---|---|---|
| `POSTGRES_HOST` / `POSTGRES_PORT` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | — | Servidor PostgreSQL |
| `POSTGRES_DB` | `estado_diario` | Base **principal**: clientes, administradores y configuraciones |
| `TENANT_DB_PREFIJO` | `estado_diario_` | Prefijo de la base de cada cliente: `<prefijo><guid>` |
| `BACKEND_SECRET_KEY` | — | Firma de los tokens **y** semilla del cifrado y del hash de búsqueda. Tiene que ser la misma que usa `backend/` o los dos servicios no se entienden |
| `ADMIN_INICIAL_USUARIO` / `ADMIN_INICIAL_PASSWORD` | `admin` / `admin123` | Primer administrador, sembrado solo si la tabla está vacía |
| `ADMIN_API_PORT` | `8092` | Puerto (informativo: lo fija el comando de arranque) |
| `ADMIN_API_CORS_ORIGINS` | `http://localhost:4401` | Orígenes que el navegador puede usar para llamar a esta API, separados por coma |

**CORS.** En el despliegue con Docker no hace falta tocarlo: el contenedor
`admin_app` sirve la SPA y redirige `/api/` a este servicio, así que las dos
quedan en el mismo origen y `environment.prod.ts` usa una URL relativa.

Solo aplica si se sirve la SPA desde otro host que el de la API (o si se expone
el 8092 directo a un navegador). Ahí hay que cambiar juntas dos cosas o la
consola queda en blanco sin ningún error de servidor: `ADMIN_API_CORS_ORIGINS`
acá y `apiUrl` en `admin_app/src/environments/environment.prod.ts`. En
desarrollo pasa siempre, porque el dev-server (4401) y la API (8092) son
orígenes distintos.

## Qué hace al arrancar

1. Crea o pone al día el esquema de la base **principal**.
2. Siembra el primer administrador si la tabla `usuario` está vacía. Nace con
   `debe_cambiar_password`: la clave inicial sirve para entrar y para nada más
   — mientras esté puesta, `require_admin` responde 403 en todos los endpoints
   de administración. La clave no se escribe en el log.

Lo que **no** hace es poner al día las bases de los clientes que ya existen: eso
le toca al backend de los estudios, que es quien las usa en cada request.
Hacerlo también acá abriría una conexión por cliente en cada reinicio de la
consola sin ganar nada.

## Aislamiento

El token de esta consola lleva `ambito=sistema`; el de un usuario de estudio
lleva `ambito=cliente`. `get_admin_actual` rechaza con 403 cualquier token que
no sea del primer tipo, así que una sesión de estudio válida y vigente no abre
un solo endpoint de acá. Al revés funciona igual en `backend/`.

Cuando la administración necesita datos de un estudio (usuarios, dashboard,
bitácora), el guid de la base sale de la ficha del cliente leída de la base
principal — **nunca de un parámetro de la request**.
