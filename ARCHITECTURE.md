# Arquitectura del Sistema - Estado Diario CRM

## Visión General

Sistema CRM de 2 capas para la gestión de Estado Diario, **multi-cliente con una
base de datos por cliente**.

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
│                                                          │
│  ┌──────────┐  ┌──────────────┐                          │
│  │ Frontend  │  │   Backend    │                          │
│  │ Angular 19│──│  FastAPI     │──┐                       │
│  │ :8090     │  │  :8091       │  │                       │
│  └──────────┘  └──────────────┘  │                       │
└──────────────────────────────────┼───────────────────────┘
                                   │ host.docker.internal
                    ┌──────────────▼────────────────────────┐
                    │  Host Linux — PostgreSQL :5432        │
                    │                                       │
                    │  estado_diario          (principal)   │
                    │   └ cliente, usuario admin, config    │
                    │                                       │
                    │  estado_diario_<guid>   (cliente A)   │
                    │  estado_diario_<guid>   (cliente B)   │
                    │   └ las 18 tablas operativas          │
                    └───────────────────────────────────────┘
```

### Una base por cliente

Cada estudio jurídico es un **cliente** con su propia base de datos. La base
principal no guarda datos operativos de nadie: solo la tabla `cliente`, los
administradores de la plataforma y las configuraciones.

Se eligió una base por cliente y no una columna `cliente_id` en cada tabla
porque el aislamiento pasa a ser del motor y no de que nadie olvide un `WHERE`:
una consulta sin filtro devuelve, como mucho, los datos del propio cliente.

**Cómo sabe una request a qué base ir:** el JWT del usuario lleva el `guid` de
su cliente. `get_db_tenant` (app/core/deps.py) lo lee del token —**nunca de un
header ni de un parámetro**— y abre la sesión sobre esa base. El frontend manda
además `X-Cliente-Guid`, que solo se usa para verificar que calce con el token;
si no calza, la request se rechaza con 403.

Hay dos `DeclarativeBase` separadas porque `usuario` existe en las dos bases con
columnas distintas: `BaseMaestra` (base principal) y `BaseTenant` (base de
cliente). Con un solo `MetaData` serían la misma tabla y `create_all()` crearía
las 18 tablas del cliente dentro de la base principal.

### Esquema sin Alembic

El esquema se mantiene desde el código: `app/core/esquema.py` lo crea y lo
actualiza al arrancar (base principal) y al aprovisionar un cliente. Como
`create_all()` nunca altera una tabla existente, **agregar una columna son tres
pasos**: declararla en el modelo, agregarla a `COLUMNAS_NUEVAS_TENANT` o
`COLUMNAS_NUEVAS_MAESTRA`, y si lleva índice, a los `INDICES_*`. Saltarse el
segundo paso funciona en una base recién creada y falla en producción con
`UndefinedColumn`.

Al arrancar, el backend aplica el esquema vigente a **todas** las bases de
cliente existentes (`APLICAR_ESQUEMA_TENANTS_AL_ARRANCAR`): sin eso, un
despliegue con columnas nuevas solo las crearía en los clientes nuevos.

Producción corre PostgreSQL 9.2, que no entiende `ADD COLUMN IF NOT EXISTS`
(9.6), `CREATE INDEX IF NOT EXISTS` (9.5) ni `FILTER (...)` en los agregados
(9.4). La idempotencia se resuelve consultando `information_schema` y
`pg_indexes` antes de cada DDL.

### Quién puede hacer qué

Hay **tres roles** y conviene no confundirlos, porque dos se llaman parecido:

| Rol | Dónde vive | Qué decide |
|-----|-----------|------------|
| Administrador de la plataforma (`superadmin`) | base principal | Los clientes, sus usuarios y sus casillas de ingesta |
| Administrador del estudio (`admin`) | base del cliente | **Qué ve cada usuario de su estudio** |
| Usuario (`usuario`) | base del cliente | Nada de configuración; opera sus causas |

El estudio **no** crea usuarios ni configura su casilla de correo: de qué
casilla se lee determina en qué base entra cada archivo, así que es decisión de
la plataforma. Lo que el administrador del estudio reparte es visibilidad.

### Visibilidad dentro de un estudio: por jurisdicción

`usuario_jurisdiccion` (usuario_id, jurisdiccion_id) dice qué jurisdicciones ve
cada persona. La regla, resuelta en **un solo lugar**
(`EstadoDiarioService.alcance()`):

- administrador del estudio → ve todo;
- **sin filas asignadas → ve todo** (nadie le restringió nada);
- con filas → solo esas jurisdicciones, más lo que quedó **sin clasificar**.

Dos decisiones que parecen descuidos y no lo son:

**Lista vacía = ve todas, no "no ve nada".** Un estudio que nunca abrió la
pantalla de permisos sigue funcionando igual, y no hay forma de dejar a alguien
con el sistema en blanco: una cuenta que no ve nada se reporta como falla, no
como falta de permisos. Para cortar el acceso se desactiva la cuenta.

**Lo sin jurisdicción lo ve todo el mundo.** El parser no siempre logra
clasificar una causa. Esconderla sería más estricto, pero la haría desaparecer
sin que nadie lo note: nadie echa de menos una causa que no sabe que existe.

Antes el criterio era el **dueño del archivo** (`usuario_carga_id`). Dejó de
servir al pasar a una casilla de ingesta por estudio: todo lo importado queda a
nombre de un solo usuario y el resto del estudio no veía nada. `usuario_carga_id`
sobrevive como dato de auditoría.

No todo se acota igual, y la diferencia importa:

| Qué | Alcance | Por qué |
|-----|---------|---------|
| Causas, movimientos, audiencias | jurisdicción | Es el permiso |
| Recordatorios | jurisdicción de SU causa | Si ve la causa, tiene que saber que un colega ya la agendó |
| Archivos recibidos | ninguno, son del estudio | Esconderlos dejaría sin saber si llegó el estado diario del día |
| Plantillas de informe | dueño | Es un artefacto personal; su CONTENIDO sí va por jurisdicción |
| Credencial de Google Calendar | dueño | Es la cuenta de esa persona |

### Datos personales cifrados

En la base del cliente, `usuario.usuario`, `.correo` y `.telefono` van cifrados
con Fernet (reversible: hay que poder mostrarlos y escribirle a la persona). Lo
mismo el `rut` y el `correo` del cliente en la base principal.

Fernet no es determinista, así que no se puede buscar por la columna cifrada:
cada campo por el que se busca lleva al lado un `*_hash` (HMAC, `UNIQUE`) y las
consultas van por ahí. Ver `app/core/hash_busqueda.py`. Los setters de los
modelos cifran y calculan el hash solos; el resto del código trabaja en claro.

### El RUT del archivo no es el del estudio

`usuario_rut` guarda los RUT con los que **cada persona** recibe los reportes
del PJUD. Existe porque el Poder Judicial emite cada archivo a nombre del
abogado que lo pide: un estudio con cinco abogados recibe archivos con cinco
RUT distintos y ninguno es el de la ficha del cliente.

Es lo que decide si al importar se advierte que el archivo parece de otro.
Antes se comparaba contra `cliente.rut`, y eso dejaba a todo el estudio salvo
al titular con una advertencia permanente, que es la forma más rápida de que
una advertencia deje de leerse.

Son varios por persona porque un abogado puede litigar además a nombre de una
sociedad. Los carga la plataforma en la ficha del usuario; **sin ninguno se
sigue comparando contra el RUT del estudio**, que es el comportamiento
anterior: el aviso pierde precisión pero no desaparece.

El RUT va cifrado como el resto de los datos personales, más una copia
normalizada en claro (`rut_normalizado`) para poder comparar sin descifrar la
lista entera. No lleva hash de búsqueda porque nunca se busca por él: siempre
se llega desde el usuario.

### La cartera de causas es una foto, no un incremental

El Excel de Causas trae **todas** las causas del estudio cada vez que se emite.
Cada carga crea su propio `estado_diario_origen` e inserta la cartera completa
de nuevo, así que sumar las filas de todos los archivos multiplica la cartera
por la cantidad de veces que se cargó el reporte.

Por eso las consultas de cartera se acotan al **último archivo** salvo que se
pida uno concreto (`ultimo_origen_causas_id`, en `causa_repository`). Vale para
"Mis Causas", para el contador de causas activas de la consola y, sobre todo,
para la facturación: sin eso se cobraría de más.

Qué causa está vigente lo define `app/core/estados_causa.py`, en un solo lugar
porque lo consultan tres consumidores que no comparten código: el filtro de la
pantalla (ORM), el contador de la consola y el cierre de facturación (SQL
crudo, una base por cliente). Terminadas son `Concluido` y `Fallada o
Concluida`; **el estado nulo cuenta como vigente**, porque la hoja de Cobranza
no trae esa columna y tratarlo como terminado borraría Cobranza entera de la
cartera y de la factura.

## Backend - Clean Architecture

```
backend/
├── app/
│   ├── main.py                     # Punto de entrada; siembra el admin inicial
│   ├── core/
│   │   ├── config.py               # Settings (pydantic-settings)
│   │   ├── database.py             # BaseMaestra/BaseTenant, caché de engines
│   │   ├── esquema.py              # Crea y actualiza el esquema (sin Alembic)
│   │   ├── crypto.py               # Cifrado reversible (Fernet)
│   │   ├── hash_busqueda.py        # HMAC para buscar sobre campos cifrados
│   │   ├── security.py             # JWT, bcrypt
│   │   ├── password_policy.py      # Formato exigido a una contraseña
│   │   ├── recaptcha.py            # Verificación v3 de los formularios públicos
│   │   ├── deps.py                 # Ruteo por tenant y autenticación
│   │   ├── exceptions.py
│   │   └── logging_config.py
│   ├── models/                     # Tablas de la base del CLIENTE (BaseTenant)
│   │   ├── usuario.py              #   campos cifrados + hash de búsqueda
│   │   ├── usuario_rut.py          #   RUT con los que recibe archivos del PJUD
│   │   ├── password_historial.py   #   últimas contraseñas, para no repetirlas
│   │   ├── jurisdiccion.py
│   │   ├── estado_diario_origen.py
│   │   ├── estado_diario.py
│   │   ├── estado_diario_agenda.py
│   │   ├── movimiento.py
│   │   ├── audiencia.py
│   │   ├── log_actividades.py
│   │   └── maestra/                # Tablas de la base PRINCIPAL (BaseMaestra)
│   │       ├── cliente.py
│   │       ├── usuario_admin.py    #   administrador de la plataforma
│   │       ├── password_historial_admin.py  # su historial de contraseñas
│   │       ├── configuracion_sistema.py
│   │       ├── facturacion_cierre.py   #  lo cobrado a un cliente en un mes
│   │       ├── factura.py          #   la orden de compra emitida + su PDF
│   │       └── configuracion_*.py  #   correo, smtp, google, whatsapp
│   ├── schemas/                    # Pydantic DTOs
│   ├── repositories/               # Acceso a datos
│   ├── services/
│   │   ├── auth_service.py         # Dos flujos: admin y cliente
│   │   ├── password_service.py     # Cambio de clave + historial (los dos)
│   │   ├── password_reset_service.py     # Recuperación por correo
│   │   ├── cliente_service.py      # Alta y ficha del cliente
│   │   ├── aprovisionamiento_service.py  # CREATE DATABASE + 18 tablas
│   │   ├── admin_cliente_service.py      # Operar SOBRE un cliente
│   │   └── admin_dashboard_service.py
│   ├── api/v1/
│   │   ├── router.py
│   │   └── endpoints/
│   │       ├── auth.py, auth_admin.py
│   │       ├── clientes.py, admin_sistema.py   # consola de plataforma
│   │       └── estado_diario.py, movimientos.py, audiencias.py, ...
│   └── jobs/                       # Tareas de cron (recorren los clientes)
│       ├── revisar_correo.py
│       ├── enviar_recordatorios_whatsapp.py
│       ├── purgar_logs.py
│       ├── cerrar_facturacion.py   # El día 1: congela el mes que terminó
│       └── migrar_a_multitenant.py # Un solo uso: ver "Migración"
├── Dockerfile
└── requirements.txt
```

### Flujo de una Request

```
HTTP Request
  → FastAPI Router (endpoints/)
    → get_tenant_actual   (lee el guid del JWT firmado)
      → get_db_tenant     (abre sesión sobre la base de ESE cliente)
        → Service (lógica de negocio)
          → Repository (acceso a datos)
            → SQLAlchemy Model → PostgreSQL
```

Los endpoints de administración (`/api/v1/admin/...`, `/api/v1/auth/admin`) no
llevan tenant: van por `get_db_maestra`, sobre la base principal.

### Seguridad (JWT)

Hay **dos flujos de autenticación** que no comparten tabla ni base de datos:

```
Administrador de la plataforma      Usuario de un cliente
  POST /auth/admin/login              POST /auth/login
  usuario + password                  rut + usuario + password
  contra la base principal            el RUT resuelve a qué base entrar
  ambito = "sistema"                  ambito = "cliente" + guid + cliente_id
```

Un token de un ámbito no abre nada del otro. El del cliente lleva el `guid`
firmado: es lo que rutea cada request a su base.

```
Login → access_token + refresh_token
  │
  ├── access_token (30 min)
  │   → Authorization: Bearer <token>
  │
  └── refresh_token (7 días)
      → POST /api/v1/auth/refresh   (despacha según el ambito del token)
```

Con `debe_cambiar_password` puesto, el administrador entra pero **ningún
endpoint de administración responde** hasta que cambie la clave: con una clave
provisoria conocida, cualquiera que la adivine podría crear clientes.

### Política de contraseñas

Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número, y
**sin repetir ninguna de las últimas 4** (la vigente y las tres anteriores).

La regla es del sistema y no de la pantalla: vale igual para el usuario de un
estudio y para el administrador de la plataforma, y se aplica por los cuatro
caminos por los que puede cambiar una clave —cambio voluntario, cambio de la
provisoria, alta o reseteo hecho por la plataforma, y restablecimiento por
correo—. El formato está en `app/core/password_policy.py` y el historial en
`app/services/password_service.py`; todo lo demás llama ahí.

El historial vive en `usuario_password_historial`, una tabla por base
(`PasswordHistorial` en la del cliente, `PasswordHistorialAdmin` en la
principal), y guarda **hashes bcrypt**, no contraseñas: comprobar es un
`checkpw` contra cada fila, igual que el login. Solo se conservan las últimas 4
por usuario; el resto se poda al cambiar.

Las cuentas anteriores a esta funcionalidad no tienen ninguna fila y no por eso
quedan sin regla: la clave vigente se veta siempre, porque sale del propio
usuario y no del historial.

El frontend repite las comprobaciones de formato (`core/utils/password.ts`)
para poder mostrarlas mientras la persona escribe. Es una copia, no la
política: si acá cambia el largo o se agrega una regla, allá hay que
actualizarlo a mano.

### Recuperación de contraseña por correo

Solo para el usuario de un estudio. El administrador de la plataforma no la
tiene: su clave se la resetea otro administrador desde la consola.

```
POST /api/v1/auth/recuperar-password     rut + correo
  → correo con  <PUBLIC_BASE_URL>/restablecer-clave?token=<jwt>
POST /api/v1/auth/restablecer-password   token + clave nueva
```

El RUT va por lo mismo que en el login: dice en qué base buscar. El correo es
la credencial de este flujo, y por eso `usuario.correo` es UNIQUE.

Tres decisiones que sostienen el flujo:

**El enlace no abre sesión.** El token lleva `type: reset_password`, que el
validador de sesiones rechaza: sirve para cambiar la clave y para nada más.

**Vale una sola vez, sin tabla de tokens.** El token lleva una huella
(SHA-256 truncado) del hash de la contraseña vigente al emitirlo. Cambiada la
clave el hash es otro, la huella deja de calzar y todos los enlaces anteriores
mueren juntos. Una tabla de tokens haría lo mismo con una fila que hay que
crear, buscar, marcar y purgar.

**El paso 1 responde siempre igual**, exista o no la cuenta: contestar distinto
lo convertiría en una forma de averiguar qué correos son usuarios del sistema.
La excepción es que el correo no se pueda enviar; ahí se devuelve el error,
porque la alternativa es dejar a alguien esperando para siempre un correo que
nadie mandó.

El correo sale por la cuenta SMTP global del sistema (la misma de los
informes), que vive en la base principal. Sin ella configurada y activa, el
flujo responde que no se pudo enviar.

### reCAPTCHA v3 en los formularios públicos

Son cuatro y no tienen límite de intentos: los dos logins,
`recuperar-password` —que además manda un correo de verdad en cada llamada— y
`restablecer-password`. `app/core/recaptcha.py` los cubre, y lo comparten los
dos servicios igual que `password_policy.py`.

**Apagado mientras no haya llaves.** `activo()` exige las DOS
(`RECAPTCHA_SITE_KEY` y `RECAPTCHA_SECRET_KEY`), y sin ellas no sale ni una
petición a Google. Media configuración cuenta como apagado y se avisa al
arrancar: con solo el secret nadie podría entrar, con solo la site key la
verificación sería teatro.

Se engancha como dependencia de la ruta, no dentro del handler:

```python
dependencies=[Depends(recaptcha.verificado(recaptcha.ACCION_LOGIN))]
```

Así corta antes de que el handler abra la sesión maestra, resuelva el tenant y
corra un bcrypt de ~300 ms — que es justo el costo que el captcha existe para
evitar—, y queda declarado en la firma, donde se ve en el diff. **La función de
la dependencia es `def` y no `async def`**: los endpoints son sincrónicos, así
que FastAPI la corre en el threadpool; declarada `async`, el `requests.post`
bloquearía el event loop y cada login congelaría el servidor mientras Google
tarde.

El token viaja en el header `X-Recaptcha-Token`, no en el cuerpo: así los
cuatro schemas, el OpenAPI y los modelos TypeScript quedan intactos.

Tres decisiones que sostienen esto:

**Lo que Google opina se respeta; lo que no alcanzó a opinar se deja pasar.**
Es la única distinción del módulo. Un puntaje bajo, una acción que no calza o
un token reusado son rechazos. Un timeout, un 500 o un secret mal pegado **no**:
se aprueba y se grita en el log. Fail-closed cambiaría una caída de Google por
una caída total del producto, en la que ni el administrador puede entrar a
arreglarla, y lo que se pierde mientras tanto es volver al nivel de protección
que el sistema tenía antes de esto. `RECAPTCHA_FALLA_ABIERTA=false` lo invierte
para estar bajo ataque.

**Se valida la `action`.** Va firmada dentro del token y cada endpoint declara
la suya. Sin esto, un atacante abre `restablecer-clave` —pública, carga sin
credenciales—, deja que le acuñen un token con puntaje de humano y lo reusa
contra el login para su fuerza bruta: misma llave, mismo dominio, mismo
puntaje, indistinguible salvo por ese campo.

**La site key la sirve el backend** (`GET /auth/recaptcha`, público) en vez de
compilarse en los siete `environment.ts`. La site key y el secret son un par:
separarlos en repositorios con ciclos de despliegue distintos garantiza que
algún día no coincidan, y un par desincronizado falla el 100% de las
verificaciones con un error que no apunta a su causa. Además encender o apagar
pasa a ser una variable de entorno en vez de reconstruir tres imágenes Angular.

En el frontend el token lo pide **el interceptor**, no los componentes: se
acuña milisegundos antes del POST, y con eso la vida útil de dos minutos del
token deja de importar. El cliente nunca falla abierto — ante cualquier
problema manda la petición sin token y decide el servidor, que es el único lado
donde la decisión no se puede falsificar.

**El APK queda fuera.** Su WebView corre desde `https://localhost`, origen que
no está registrado en la consola de Google, así que el servicio ni carga el
script en nativo (`Capacitor.isNativePlatform()`) y la petición sale sin token.
Con el rechazo encendido, **el APK no puede iniciar sesión**. No hay forma
segura de eximirlo: cualquier marca que la app enviara la copia un atacante, y
eximir por esa marca es apagar el captcha para todos. Por eso se estrena en
modo monitor (`RECAPTCHA_SOLO_REGISTRAR`), que mide cuánto tráfico legítimo
llega sin token antes de bloquear nada — ver DEPLOY.md.

## Frontend - Angular 19

```
frontend/src/app/
├── app.config.ts                   # Providers (router, http, interceptors)
├── app.routes.ts                   # Lazy loading routes
├── core/                           # Singleton services
│   ├── guards/
│   │   └── auth.guard.ts           # Protege rutas autenticadas
│   ├── interceptors/
│   │   ├── auth.interceptor.ts     # Agrega Bearer token + refresh
│   │   └── error.interceptor.ts    # Manejo centralizado de errores
│   ├── services/
│   │   ├── auth.service.ts         # Autenticación, signals
│   │   └── notification.service.ts # Alertas con signals
│   ├── utils/
│   │   └── password.ts             # Copia de la política, para mostrarla
│   └── models/                     # Interfaces TypeScript
├── features/
│   ├── auth/
│   │   ├── login.component.ts      # Login page
│   │   ├── cambiar-clave.component.ts     # Cambio obligatorio (provisoria)
│   │   ├── recuperar-clave.component.ts   # "Olvidé mi contraseña" (paso 1)
│   │   └── restablecer-clave.component.ts # Destino del enlace (paso 2)
│   ├── layout/
│   │   └── layout.component.ts     # Sidebar + topbar + outlet
│   └── estado-diario/
│       ├── services/
│       │   └── estado-diario.service.ts
│       └── components/
│           ├── origenes-list/      # Lista de archivos cargados
│           ├── upload-form/        # Upload XLS/XLSX
│           ├── movimientos-list/   # Vista de movimientos filtrada
│           └── movimiento-detail/  # Detalle + acciones + agenda
└── shared/                         # Componentes reutilizables (via CSS)
```

### Patrones Angular

- **Standalone Components**: Sin NgModules
- **Signals**: Estado reactivo en services y components
- **Lazy Loading**: Cada ruta carga su componente bajo demanda
- **Functional Guards/Interceptors**: Sin clases
- **Tailwind CSS**: Design system via CSS components layer

## Base de Datos

### Base principal (`estado_diario`)

```
┌────────────────────────────┐
│          cliente           │   Un estudio contratante.
├────────────────────────────┤
│ cliente_id (PK)            │
│ nombre                     │
│ rut          ← cifrado     │
│ rut_hash     ← por acá se busca en el login (UNIQUE)
│ correo       ← cifrado     │
│ guid         ← identifica su base y su casilla (UNIQUE)
│ base_datos   ← estado_diario_<guid>
│ estado_aprovisionamiento   ← en_cola | creando | listo | error
│ dias_retencion_log         ← override de la política global
│ activo                     ← suspendido = no entra nadie, no se borra nada
└─────────────┬──────────────┘
              │ 1:1
   ┌──────────┴───────────────────────────────────┐
   │ configuracion_correo   (casilla IMAP, una por cliente)
   │ configuracion_smtp / _google / _whatsapp
   │        cliente_id NULL = fila global del sistema
   └──────────────────────────────────────────────┘

   usuario                → administrador de la PLATAFORMA (no opera causas)
   configuracion_sistema  → parámetros globales, una sola fila
   facturacion_cierre     → lo cobrado a un cliente en un mes, congelado
                            (cliente_id, periodo) UNIQUE
   factura / factura_linea → la orden de compra emitida y su detalle por mes,
                            con el PDF entregado y los datos del cliente
                            COPIADOS (numero UNIQUE)
```

### Base de cada cliente (`estado_diario_<guid>`)

Las 18 tablas operativas. El esquema es idéntico en todas; lo que cambia es a
cuál se conecta la request.

```
┌──────────────┐     ┌───────────────────────┐     ┌──────────────┐
│   usuario    │     │  estado_diario_origen  │     │ jurisdiccion │
├──────────────┤     ├───────────────────────┤     ├──────────────┤
│ id (PK)      │◄────│ usuario_carga_id (FK) │     │ id (PK)      │
│ usuario ←cif.│     │ id (PK)               │     │ nombre       │
│ usuario_hash │     │ rut                   │     └──────┬───────┘
│ correo  ←cif.│     │ fecha                 │            │
│ password_hash│     │ nombre_archivo        │            │
│ nombre       │     │                       │            │
│ apellido     │     │ fecha_carga           │            │
│ activo       │     └───────────┬───────────┘            │
│ rol          │                 │ 1:N                    │
└──────┬───────┘     ┌───────────┴───────────┐            │
       │             │    estado_diario      │            │
       │             ├──────────────────────-┤            │
       │             │ id (PK)               │            │
       ├─────────────│ estado_diario_origen_id│            │
       │             │ jurisdiccion_id (FK)──────────────-─┘
       │             │ rol, caratulado       │
       │             │ tribunal, estado      │
       ├─────────────│ usuario_leido_id (FK) │
       ├─────────────│ usuario_pendiente_id  │
       │             │ leido, pendiente      │
       │             │ nivel_pendiente       │
       │             └───────────┬───────────┘
       │                         │ 1:N
       │             ┌───────────┴───────────┐
       │             │ estado_diario_agenda   │
       │             ├───────────────────────┤
       │             │ id (PK)               │
       │             │ estado_diario_id (FK)  │
       ├─────────────│ usuario_registro_id   │
       │             │ detalle               │
       │             │ fecha_hora            │
       │             │ enviado               │
       │             └───────────────────────┘
       │
       │             ┌───────────────────────────┐
       │             │ api_llamado_estado_diario  │
       │             ├───────────────────────────┤
       │             │ id (PK)                   │
       │             │ endpoint                  │
       │             │ estado_diario_id (FK)      │
       │             │ json_request/response      │
       │             │ exito, mensaje_error       │
       │             │ fecha_registro             │
       │             └───────────────────────────┘
```

## API Endpoints

### Autenticación
| Método | Ruta                          | Descripción                        |
|--------|-------------------------------|------------------------------------|
| POST   | /api/v1/auth/login            | Login de cliente (rut + usuario)   |
| POST   | /api/v1/auth/refresh          | Renovar token (cualquier ámbito)   |
| GET    | /api/v1/auth/me               | Info usuario actual                |
| POST   | /api/v1/auth/cambiar-password | Cambiar la clave provisoria        |
| POST   | /api/v1/auth/admin/login      | Login del admin de la plataforma   |
| GET    | /api/v1/auth/admin/me         | Info del admin actual              |

### Consola de administración de la plataforma

Exige administrador del sistema con la clave ya definitiva. Opera sobre la base
principal; algunas operaciones abren además la base del cliente indicado.

| Método   | Ruta                                              | Descripción                          |
|----------|---------------------------------------------------|--------------------------------------|
| GET      | /api/v1/admin/dashboard                           | KPIs y actividad por cliente         |
| GET/POST | /api/v1/admin/clientes                            | Listar / dar de alta un cliente      |
| GET/PUT  | /api/v1/admin/clientes/{id}                       | Ficha del cliente                    |
| GET      | /api/v1/admin/clientes/{id}/aprovisionamiento     | Estado real de su base de datos      |
| POST     | /api/v1/admin/clientes/{id}/aprovisionamiento/reintentar | Reintentar el alta que falló  |
| POST     | /api/v1/admin/clientes/{id}/suspender \| reactivar | Corta el acceso; no borra nada      |
| GET/PUT  | /api/v1/admin/clientes/{id}/inbox                 | Casilla de ingesta del cliente       |
| POST     | /api/v1/admin/clientes/{id}/inbox/probar          | Probar la conexión IMAP              |
| GET/POST | /api/v1/admin/clientes/{id}/usuarios              | Usuarios, **en la base del cliente** |
| PUT      | /api/v1/admin/clientes/{id}/usuarios/{uid}        | Editar / resetear clave              |
| GET      | /api/v1/admin/facturacion                         | Detalle y totales de un período      |
| GET      | /api/v1/admin/facturacion/clientes/{id}           | Historial facturado de un cliente    |
| POST     | /api/v1/admin/facturacion/cerrar                  | Cerrar un período a mano             |
| GET/POST | /api/v1/admin/facturacion/facturas                | Órdenes de compra: listar / emitir   |
| GET      | /api/v1/admin/facturacion/facturas/{id}/pdf       | Descargar el PDF guardado            |
| POST     | /api/v1/admin/facturacion/facturas/{id}/anular    | Anular sin liberar el número         |

### Dentro del estudio

| Método  | Ruta                                  | Quién                  |
|---------|---------------------------------------|------------------------|
| GET     | /api/v1/usuarios                      | admin del estudio      |
| GET     | /api/v1/usuarios/permisos             | admin del estudio      |
| PUT     | /api/v1/usuarios/{id}/permisos        | admin del estudio      |
| GET     | /api/v1/configuracion-correo          | admin del estudio (solo lectura) |
| GET     | /api/v1/configuracion-correo/log      | admin del estudio      |

No existen `POST /usuarios` ni `PUT /configuracion-correo`: crear cuentas y
configurar la casilla son de la plataforma.
| GET/PUT  | /api/v1/admin/configuracion/sistema               | Política de permanencia del log      |
| POST     | /api/v1/admin/configuracion/sistema/purgar-log    | Purgar la bitácora de todos          |

### Estado Diario
| Método | Ruta                                        | Descripción                  |
|--------|---------------------------------------------|------------------------------|
| GET    | /api/v1/jurisdicciones                      | Listar jurisdicciones        |
| GET    | /api/v1/estado-diario/origenes              | Listar orígenes paginados    |
| POST   | /api/v1/estado-diario/upload                | Subir archivo XLS/XLSX       |
| DELETE | /api/v1/estado-diario/origenes/{id}         | Eliminar origen              |
| GET    | /api/v1/estado-diario/origenes/{id}/movimientos | Movimientos de un origen |
| GET    | /api/v1/estado-diario/no-leidos             | Movimientos no leídos        |
| GET    | /api/v1/estado-diario/leidos                | Movimientos leídos           |
| GET    | /api/v1/estado-diario/pendientes            | Movimientos pendientes       |
| GET    | /api/v1/estado-diario/{id}                  | Detalle de movimiento        |
| POST   | /api/v1/estado-diario/{id}/leido            | Marcar como leído            |
| POST   | /api/v1/estado-diario/{id}/pendiente        | Marcar como pendiente        |
| GET    | /api/v1/estado-diario/{id}/agendas          | Listar agendas               |
| POST   | /api/v1/estado-diario/{id}/agenda           | Crear entrada de agenda      |
| POST   | /api/v1/estado-diario/request-tw            | Webhook Twilio (público)     |

### Webhook de Twilio (`/api/v1/estado-diario/request-tw`)

Recibe las respuestas de los botones de los recordatorios de WhatsApp. En la
consola de Twilio debe quedar configurado con la **URL pública** del sitio
(`PUBLIC_BASE_URL` + la ruta), porque esa URL es parte de la firma.

- Es público (sin Bearer): quien llama es Twilio. Lo autentica la cabecera
  `X-Twilio-Signature`, validada con el Auth Token; se puede desactivar en
  Configuración → WhatsApp si la firma no calza.
- Ubica el recordatorio por `OriginalRepliedMessageSid` = `estado_diario_agenda.twilio_sid`.
- Botón "Resuelto": marca el movimiento leído y finaliza el recordatorio.
- Cualquier otro botón: posterga `ButtonPayload` minutos creando un
  recordatorio nuevo (copia del original) y finalizando el anterior.
- Cada llamada, aceptada o rechazada, queda en `api_llamado_estado_diario`.

## Facturación

Se cobra por cantidad de causas de la cartera vigente de cada cliente:

| Qué | Precio por causa |
|-----|------------------|
| Materia (Civil, Laboral, Penal, Cobranza, Familia) | $1 |
| Corte de Apelaciones | $2 |
| Corte Suprema | $3 |

Las de materia se cuentan **solo si están vigentes**; las de corte se cuentan
todas. No es un descuido: "Fallada" en una corte dice que se falló ese recurso,
no que la causa salió de la cartera del estudio, y el reporte deja de traerla
cuando eso pasa.

**El cierre es el día 1 y se guarda.** Por lo de la sección anterior —la
cartera es una foto que se reemplaza— el período de marzo no se puede
reconstruir en junio: ese archivo ya no está en la base. Así que el día 1 se
cuenta una vez, se calcula el monto y se escribe una fila por cliente en
`facturacion_cierre` (base principal). Lo que se factura después sale de ahí y
no de volver a contar: una factura emitida no puede cambiar de monto porque el
estudio cerró tres causas.

El cierre del día 1 factura **el mes que terminó**: correr el job el 1 de
agosto crea el período `2026-07-01`.

Cada fila guarda las tres cantidades **y las tarifas vigentes al cierre**. Sin
las cantidades, una factura discutida no se puede explicar; sin las tarifas,
subir el precio reescribiría el monto de los meses ya cerrados.

Un cliente cuya base no responde queda en estado `error` en vez de tumbar el
cierre de los demás: es lo que distingue "este mes no tuvo causas" de "este mes
no pudimos preguntarle", dos cosas que no se facturan igual. El job devuelve
código 1 cuando hay alguno, para que el cron lo reporte.

Es idempotente por el `UNIQUE (cliente_id, periodo)` más el salto de los que ya
tienen cierre: dispararlo dos veces el día 1 no duplica ninguna factura.

La consola muestra además el **período en curso como estimación**, contándolo
al momento y marcado como tal. Es la pregunta que se hace el 20 del mes —cuánto
va a salir la factura— y responder "no hay datos" haría parecer que el módulo
no funciona.

### La orden de compra

Es el documento que se entrega. Cubre un **rango de fechas** y suma los cierres
mensuales que caen dentro; se factura por mes completo, así que entra todo mes
que se cruce con el rango. Un mes sin cierre **rechaza la emisión** en vez de
contarse al momento: mezclar montos congelados con montos que cambian solos
daría un documento que nadie puede después reconstruir.

Todo lo que se imprime queda **copiado** en `factura`: la razón social, el RUT,
el giro y la dirección del cliente, y las cantidades y tarifas de cada mes. Una
orden emitida no puede cambiar porque el cliente se mudó o porque se rehízo un
cierre.

El PDF se guarda entero (`factura.pdf`) y se devuelve ESE al descargar, no uno
regenerado: un cambio en el dibujo o en el formato de los números bastaría para
que la copia que el cliente tiene en su correo y la que descarga hoy dejaran de
ser el mismo documento.

**Sobre "no modificable".** El PDF sale con la edición, la copia y las
anotaciones bloqueadas por los permisos del formato, con una clave de
propietario derivada de `BACKEND_SECRET_KEY` (no guardada). Eso **disuade, no
impide**: los permisos de PDF los ignora cualquier herramienta libre y así está
diseñado el formato. La garantía real es la copia guardada. Para que la
alteración sea detectable sin tenerla al lado hace falta una firma digital con
certificado, no más permisos.

El correlativo es global y se asigna con `LOCK TABLE factura IN EXCLUSIVE MODE`
en vez de una secuencia: **una secuencia deja huecos** cuando la transacción se
deshace —los `nextval` no se revierten— y un talonario al que le falta el 47 es
algo que después nadie puede explicar. Por lo mismo, anular no borra ni libera
el número.

No es un DTE del SII: no lleva folio autorizado (CAF) ni timbre electrónico, y
el pie del PDF lo dice.

## Tareas programadas

Todas recorren los clientes activos y abren una sesión por base. Un cliente con
la base caída no impide que se procesen los demás; los que todavía no tienen la
base lista se saltan.

```
*/15 * * * *  docker exec ed_backend python -m app.jobs.revisar_correo
*/5  * * * *  docker exec ed_backend python -m app.jobs.enviar_recordatorios_whatsapp
30 3 * * *    docker exec ed_backend python -m app.jobs.purgar_logs
0  4 1 * *    docker exec ed_backend python -m app.jobs.cerrar_facturacion
```

La hora de la revisión de correo la fija cada cliente desde la UI, no el
crontab: por eso el cron corre cada 15 minutos y es el job el que decide si le
toca.

## Migración desde la versión de una sola base

Una instalación anterior tiene todo en `estado_diario`. Convertirla en el primer
cliente es un job de un solo uso:

```bash
# Primero en seco: cuenta lo que movería, no escribe nada
python -m app.jobs.migrar_a_multitenant --nombre "Estudio X" --rut 76543210-K --ensayo
python -m app.jobs.migrar_a_multitenant --nombre "Estudio X" --rut 76543210-K
```

Aparta las tablas viejas como `_legacy_*`, crea el esquema nuevo de la base
principal, da de alta el cliente con su base, y copia usuarios (cifrándolos) y
las 10 tablas operativas **conservando los id**, para que las referencias entre
ellas sigan apuntando a lo mismo.

**No borra nada**: lo viejo queda con el prefijo `_legacy_` para poder comparar.
Se elimina a mano una vez verificada la migración. Se puede repetir si falla a
la mitad; lo que no se puede es correrlo dos veces para crear dos clientes.

Hay que correrlo **antes** de levantar el backend nuevo contra esa base: el
esquema viejo tiene `usuario` y `configuracion_correo` con otra forma y el
arranque las dejaría sin las columnas que el código espera.
