# Manual de Instalación - Estado Diario CRM

## Requisitos Previos

- **Docker** >= 24.0
- **Docker Compose** >= 2.20
- **Git**
- **PostgreSQL >= 14 instalado en el host Linux** (NO se levanta en Docker)

## Preparar PostgreSQL del Host

El `docker-compose.yml` **no** incluye un contenedor de PostgreSQL: los servicios
se conectan al PostgreSQL instalado en la máquina Linux anfitriona a través de
`host.docker.internal` (resuelto con `extra_hosts: host-gateway`).

```bash
# 1. Crear usuario y base de datos PRINCIPAL
#    CREATEDB no es opcional: el sistema crea una base de datos por cada
#    cliente que se da de alta (estado_diario_<guid>). Sin ese permiso el
#    alta falla y el cliente queda en estado "error".
sudo -u postgres psql <<'SQL'
CREATE USER estado_diario WITH PASSWORD 'Estado123' CREATEDB;
CREATE DATABASE estado_diario OWNER estado_diario;
SQL

# 2. Permitir que PostgreSQL escuche en la interfaz del bridge de Docker
#    /etc/postgresql/<version>/main/postgresql.conf
listen_addresses = '*'          # o 'localhost,172.17.0.1'

# 3. Autorizar la red de Docker en pg_hba.conf
#    /etc/postgresql/<version>/main/pg_hba.conf
host    all    all    172.16.0.0/12    scram-sha-256

# 4. Reiniciar el servicio
sudo systemctl restart postgresql

# 5. Si hay firewall activo, abrir el puerto solo para la red de Docker
sudo ufw allow from 172.16.0.0/12 to any port 5432 proto tcp
```

## Instalación Rápida

```bash
# 1. Clonar el repositorio
cd C:\sitios\temposoft\estado_diario

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Editar .env con los datos del PostgreSQL del host
#    (POSTGRES_HOST=host.docker.internal, usuario, password, puertos)

# 4. Levantar todos los servicios
docker-compose up -d --build

# 5. Verificar que los servicios estén corriendo
docker-compose ps

# 6. Verificar la conexión a la BD del host desde el backend
docker exec ed_backend python -c "import socket; socket.create_connection(('host.docker.internal', 5432), 5); print('OK')"
```

## Servicios y Puertos

| Servicio   | Puerto | URL                          |
|------------|--------|------------------------------|
| Frontend   | 8090   | http://localhost:8090         |
| Backend    | 8091   | http://localhost:8091         |
| Swagger    | 8091   | http://localhost:8091/docs    |
| ReDoc      | 8091   | http://localhost:8091/redoc   |
| PostgreSQL | 5432   | localhost:5432 (servicio del host, fuera de Docker) |

> Solo hay dos contenedores: `ed_backend` y `ed_frontend`. PostgreSQL y pgAdmin
> son responsabilidad del host.

## Primer Ingreso

Hay **dos inicios de sesión distintos**:

| Quién                          | Campos                    | Qué administra                    |
|--------------------------------|---------------------------|-----------------------------------|
| Administrador de la plataforma | usuario + contraseña      | Los clientes (estudios) y el sistema |
| Usuario de un estudio          | RUT + usuario + contraseña| Las causas de su estudio          |

En el primer arranque se siembra un solo administrador de plataforma, con la
clave de `ADMIN_INICIAL_USUARIO` / `ADMIN_INICIAL_PASSWORD` del `.env` (por
defecto `admin` / `admin123`). Nace con la clave marcada como provisoria: entra,
pero **ningún otro endpoint de administración responde** hasta cambiarla.

Después:

1. Cambiar esa contraseña.
2. **Clientes → Nuevo**: nombre y RUT del estudio. El backend crea su base de
   datos; toma unos segundos y el estado se ve en la ficha.
3. Con la base en `listo`, crear los usuarios del estudio desde su ficha. Nacen
   con clave provisoria: la persona la cambia al entrar.

El RUT del cliente es la credencial con la que su gente inicia sesión, y no se
puede cambiar después.

### PostgreSQL (instalado en el host Linux)
- **Host**: host.docker.internal (desde los contenedores) / localhost (desde el host)
- **Puerto**: 5432
- **Base principal**: estado_diario
- **Base de cada cliente**: estado_diario_&lt;guid&gt; (las crea el sistema)
- **Usuario**: estado_diario (con CREATEDB)
- **Password**: Estado123

## Migrar una Instalación Anterior

Si ya había una instalación de la versión de una sola base, hay que convertirla
en el primer cliente **antes** de levantar el backend nuevo contra ella:

```bash
# En seco primero: cuenta lo que movería sin escribir nada
docker exec ed_backend python -m app.jobs.migrar_a_multitenant \
    --nombre "Estudio X" --rut 76543210-K --ensayo

# Real
docker exec ed_backend python -m app.jobs.migrar_a_multitenant \
    --nombre "Estudio X" --rut 76543210-K --correo contacto@estudio.cl
```

Copia usuarios y datos a la base del cliente conservando los id, y deja las
tablas viejas en la base principal con el prefijo `_legacy_` — no borra nada.
Las contraseñas siguen siendo las mismas; lo que cambia es que ahora hay que
indicar el RUT del estudio al iniciar sesión. Detalles en `ARCHITECTURE.md`.

## Administrar la Base de Datos

pgAdmin ya no forma parte del `docker-compose.yml`. Como PostgreSQL corre en el
host, se administra directamente desde ahí:

```bash
# Cliente de línea de comandos
psql -h localhost -U estado_diario -d estado_diario
```

Si prefieres interfaz gráfica, instala pgAdmin nativo en el host y conéctalo a
`localhost:5432`:

```bash
# Debian/Ubuntu
sudo apt install -y pgadmin4-desktop     # o pgadmin4-web
```

## Importación por Correo (opcional)

El sistema puede bajar solo los adjuntos de estado diario desde una casilla
IMAP. Hay **una casilla por cliente** y lo que llegue a ella se importa en la
base de ese cliente: la casilla es lo que amarra un correo entrante a una base.

La configuración vive en la UI, no en archivos, y se puede tocar desde dos
lados: el administrador de la plataforma, en la ficha del cliente, o el propio
estudio en **Administración → Importar por Correo** (solo rol admin del
estudio). La casilla por defecto de un cliente es `<guid>@temposoft.cl`.

### Gmail

Gmail se conecta como IMAP estándar; no requiere OAuth ni proyecto en Google
Cloud. Necesita una **contraseña de aplicación**:

1. Activar la verificación en dos pasos en la cuenta de Google.
2. Ir a https://myaccount.google.com/apppasswords y generar una contraseña.
3. En la pantalla de configuración usar `imap.gmail.com`, puerto `993`, SSL, y
   esa contraseña (no la de la cuenta).

En cuentas de Google Workspace el administrador puede tener bloqueadas las
contraseñas de aplicación; en ese caso hay que habilitarlas primero.

### Clave de cifrado

La contraseña de la casilla se guarda cifrada. Conviene fijar una clave propia
en el `.env` antes de configurarla:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# copiar el resultado a MAIL_ENCRYPTION_KEY en .env
```

Si se cambia `MAIL_ENCRYPTION_KEY` (o `BACKEND_SECRET_KEY`, de la que se deriva
cuando la primera está vacía), hay que volver a escribir la contraseña en la UI.

### Revisión diaria

La hora la fija el administrador en la UI. El crontab solo invoca el comando
cada 15 minutos; el propio job decide si corresponde ejecutar:

```bash
# crontab -e  en el host
*/15 * * * * docker exec ed_backend python -m app.jobs.revisar_correo >> /var/log/estado_diario_correo.log 2>&1
```

Para probarlo de inmediato, ignorando la hora configurada:

```bash
docker exec ed_backend python -m app.jobs.revisar_correo --forzar
```

Todo lo que ocurre queda en **Bitácora de Correo**, incluidos los mensajes
descartados y los días en que no llegó ningún archivo.

## Recordatorios: Google Calendar y WhatsApp (opcional)

Cada abogado conecta su propio Google Calendar desde **Mi Perfil** (OAuth
individual, sin organización de Google Workspace). El administrador
configura las credenciales del proyecto de Google y de Twilio desde
**Administración → Google Calendar** y **Administración → WhatsApp**; ambas
viven en la base de datos, cifradas, igual que la contraseña de correo — no
van en el `.env`.

Variables de entorno necesarias: solo `PUBLIC_BASE_URL` (la URL pública del
sitio, sin barra final), usada para armar el redirect URI de Google
(`PUBLIC_BASE_URL/api/v1/google-calendar/callback`) — hay que registrar ese
mismo redirect URI en la consola de Google Cloud al crear el Client ID.

**Importante para producción**: al ser una app sin organización de Google
Workspace, mientras el proyecto de Google Cloud esté en modo *Testing* los
`refresh_token` caducan a los 7 días y cada abogado tendría que reconectar
semanalmente. Hay que publicar la app (*In production* en la pantalla de
consentimiento OAuth) para uso real; sin verificar ante Google se muestra un
aviso "app no verificada" (se puede continuar) y hay un tope aproximado de
100 cuentas conectadas.

Envío de WhatsApp — cron cada 5 minutos, revisa qué recordatorios ya
llegaron a su fecha/hora de envío:

```bash
# crontab -e  en el host
*/5 * * * * docker exec ed_backend python -m app.jobs.enviar_recordatorios_whatsapp >> /var/log/estado_diario_whatsapp.log 2>&1
```

Requiere una cuenta Twilio con WhatsApp Business aprobado y una plantilla de
mensaje ya aprobada (Content SID), pegados en **Administración → WhatsApp**.

## Purga de la Bitácora

`log_actividades` registra una fila por acción y crece rápido. La política de
permanencia se fija en **Administración de la plataforma → Sistema** (con
override por cliente en su ficha) y la aplica un job nocturno, base por base:

```bash
# crontab -e  en el host
30 3 * * * docker exec ed_backend python -m app.jobs.purgar_logs >> /var/log/estado_diario_purga.log 2>&1
```

## Datos Iniciales (Seeds)

Al iniciar el backend, en la base **principal**:
- El administrador de la plataforma, solo si no hay ninguno (ver *Primer Ingreso*).

Al dar de alta un **cliente**, en su base recién creada:
- Las 12 tablas del esquema operativo.
- 9 jurisdicciones predefinidas (Civil, Familia, Laboral, Penal, etc.).

La base de un cliente **nace sin usuarios**: los crea el administrador desde la
ficha del cliente. Así la clave inicial la escribe alguien que la va a
comunicar, en vez de quedar una cuenta genérica que nadie recuerda desactivar.

## Desarrollo Local (sin Docker)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8091
```

### Frontend
```bash
cd frontend
npm install
npm start
# Acceder en http://localhost:4200
```

## Comandos Útiles

```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f backend

# Reiniciar un servicio
docker-compose restart backend

# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (solo uploads; la BD vive en el host y NO se borra)
docker-compose down -v

# Reconstruir un servicio
docker-compose up -d --build backend
```
