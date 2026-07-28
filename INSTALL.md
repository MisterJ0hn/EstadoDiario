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
# 1. Crear usuario y base de datos
sudo -u postgres psql <<'SQL'
CREATE USER estado_diario WITH PASSWORD 'Estado123';
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

## Credenciales por Defecto

### Aplicación
- **Admin**: usuario `admin`, password `admin123`
- **Usuario**: usuario `usuario`, password `usuario123`

### PostgreSQL (instalado en el host Linux)
- **Host**: host.docker.internal (desde los contenedores) / localhost (desde el host)
- **Puerto**: 5432
- **Base de datos**: estado_diario
- **Usuario**: estado_diario
- **Password**: Estado123

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

## Datos Iniciales (Seeds)

Al iniciar el backend, se crean automáticamente:
- Usuario administrador (admin/admin123)
- Usuario demo (usuario/usuario123)
- 9 jurisdicciones predefinidas (Civil, Familia, Laboral, Penal, etc.)

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
