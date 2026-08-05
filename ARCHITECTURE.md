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
                    │   └ las 12 tablas operativas          │
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
las 12 tablas del cliente dentro de la base principal.

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

### Datos personales cifrados

En la base del cliente, `usuario.usuario`, `.correo` y `.telefono` van cifrados
con Fernet (reversible: hay que poder mostrarlos y escribirle a la persona). Lo
mismo el `rut` y el `correo` del cliente en la base principal.

Fernet no es determinista, así que no se puede buscar por la columna cifrada:
cada campo por el que se busca lleva al lado un `*_hash` (HMAC, `UNIQUE`) y las
consultas van por ahí. Ver `app/core/hash_busqueda.py`. Los setters de los
modelos cifran y calculan el hash solos; el resto del código trabaja en claro.

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
│   │   ├── deps.py                 # Ruteo por tenant y autenticación
│   │   ├── exceptions.py
│   │   └── logging_config.py
│   ├── models/                     # Tablas de la base del CLIENTE (BaseTenant)
│   │   ├── usuario.py              #   campos cifrados + hash de búsqueda
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
│   │       ├── configuracion_sistema.py
│   │       └── configuracion_*.py  #   correo, smtp, google, whatsapp
│   ├── schemas/                    # Pydantic DTOs
│   ├── repositories/               # Acceso a datos
│   ├── services/
│   │   ├── auth_service.py         # Dos flujos: admin y cliente
│   │   ├── cliente_service.py      # Alta y ficha del cliente
│   │   ├── aprovisionamiento_service.py  # CREATE DATABASE + 12 tablas
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
│   └── models/                     # Interfaces TypeScript
├── features/
│   ├── auth/
│   │   └── login.component.ts      # Login page
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
```

### Base de cada cliente (`estado_diario_<guid>`)

Las 12 tablas operativas. El esquema es idéntico en todas; lo que cambia es a
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

## Tareas programadas

Todas recorren los clientes activos y abren una sesión por base. Un cliente con
la base caída no impide que se procesen los demás; los que todavía no tienen la
base lista se saltan.

```
*/15 * * * *  docker exec ed_backend python -m app.jobs.revisar_correo
*/5  * * * *  docker exec ed_backend python -m app.jobs.enviar_recordatorios_whatsapp
30 3 * * *    docker exec ed_backend python -m app.jobs.purgar_logs
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
