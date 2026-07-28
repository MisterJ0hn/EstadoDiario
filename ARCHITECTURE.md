# Arquitectura del Sistema - Estado Diario CRM

## Visión General

Sistema CRM de 2 capas para la gestión de Estado Diario con arquitectura moderna basada en contenedores.

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
                    ┌──────────────▼───────────────┐
                    │  Host Linux                   │
                    │  PostgreSQL 16  :5432         │
                    └───────────────────────────────┘
```

## Backend - Clean Architecture

```
backend/
├── app/
│   ├── main.py                     # Punto de entrada, FastAPI app
│   ├── core/                       # Configuración central
│   │   ├── config.py               # Settings (pydantic-settings)
│   │   ├── database.py             # Engine, SessionLocal, Base
│   │   ├── security.py             # JWT, bcrypt
│   │   ├── deps.py                 # Dependencias (get_current_user)
│   │   ├── exceptions.py           # Excepciones HTTP personalizadas
│   │   └── logging_config.py       # Configuración de logging
│   ├── models/                     # SQLAlchemy ORM Models
│   │   ├── usuario.py
│   │   ├── jurisdiccion.py
│   │   ├── estado_diario_origen.py
│   │   ├── estado_diario.py
│   │   ├── estado_diario_agenda.py
│   │   └── api_llamado_estado_diario.py
│   ├── schemas/                    # Pydantic DTOs
│   │   ├── auth.py
│   │   ├── jurisdiccion.py
│   │   └── estado_diario.py
│   ├── repositories/               # Capa de acceso a datos
│   │   ├── usuario_repository.py
│   │   ├── jurisdiccion_repository.py
│   │   ├── estado_diario_origen_repository.py
│   │   ├── estado_diario_repository.py
│   │   ├── estado_diario_agenda_repository.py
│   │   └── api_log_repository.py
│   ├── services/                   # Lógica de negocio
│   │   ├── auth_service.py
│   │   ├── estado_diario_service.py
│   │   └── import_service.py
│   ├── api/v1/                     # Controladores REST
│   │   ├── router.py
│   │   └── endpoints/
│   │       ├── auth.py
│   │       ├── jurisdicciones.py
│   │       └── estado_diario.py
│   └── migrations/                 # Alembic migrations
│       ├── env.py
│       └── versions/
├── Dockerfile
└── requirements.txt
```

### Flujo de una Request

```
HTTP Request
  → FastAPI Router (endpoints/)
    → Dependencies (auth, db session)
      → Service (lógica de negocio)
        → Repository (acceso a datos)
          → SQLAlchemy Model → PostgreSQL
```

### Seguridad (JWT)

```
Login → access_token + refresh_token
  │
  ├── access_token (30 min)
  │   → Se envía en header: Authorization: Bearer <token>
  │   → Middleware valida y extrae usuario
  │
  └── refresh_token (7 días)
      → POST /api/v1/auth/refresh
      → Genera nuevo par de tokens
```

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

### Diagrama ER

```
┌──────────────┐     ┌───────────────────────┐     ┌──────────────┐
│   usuario    │     │  estado_diario_origen  │     │ jurisdiccion │
├──────────────┤     ├───────────────────────┤     ├──────────────┤
│ id (PK)      │◄────│ usuario_carga_id (FK) │     │ id (PK)      │
│ username     │     │ id (PK)               │     │ nombre       │
│ email        │     │ rut                   │     └──────┬───────┘
│ password_hash│     │ fecha                 │            │
│ nombre       │     │ nombre_archivo        │            │
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
| Método | Ruta                | Descripción          |
|--------|---------------------|----------------------|
| POST   | /api/v1/auth/login  | Login                |
| POST   | /api/v1/auth/refresh| Renovar token        |
| GET    | /api/v1/auth/me     | Info usuario actual  |

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
