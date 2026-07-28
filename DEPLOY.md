# Manual de Despliegue - Estado Diario CRM

## Despliegue en Producción

> **PostgreSQL no se despliega en Docker.** Se usa el servidor PostgreSQL
> instalado en la máquina Linux anfitriona. Antes de desplegar, verificar que
> exista la base de datos, que `listen_addresses` incluya la interfaz del bridge
> de Docker y que `pg_hba.conf` autorice la red `172.16.0.0/12`
> (ver INSTALL.md → "Preparar PostgreSQL del Host").

### 1. Preparar Variables de Entorno

```bash
cp .env.example .env
```

Editar `.env` con valores de producción:

```env
APP_ENV=production

# PostgreSQL del host (no contenedor)
POSTGRES_HOST=host.docker.internal
POSTGRES_PORT=5432

# CAMBIAR OBLIGATORIAMENTE
POSTGRES_PASSWORD=<password-seguro>
BACKEND_SECRET_KEY=<clave-secreta-larga-aleatoria>
PGADMIN_DEFAULT_PASSWORD=<password-seguro>

# Ajustar CORS al dominio real
BACKEND_CORS_ORIGINS=https://midominio.cl

# Tokens
BACKEND_ACCESS_TOKEN_EXPIRE_MINUTES=15
BACKEND_REFRESH_TOKEN_EXPIRE_DAYS=7

# Logging
BACKEND_LOG_LEVEL=WARNING
```

### 2. Construir y Desplegar

```bash
docker-compose up -d --build
```

### 3. Verificar

```bash
docker-compose ps
curl http://localhost:8091/health
```

### 4. Configurar Reverse Proxy (Nginx)

Ejemplo para producción con Nginx como reverse proxy:

```nginx
server {
    listen 80;
    server_name midominio.cl;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name midominio.cl;

    ssl_certificate /etc/ssl/certs/midominio.crt;
    ssl_certificate_key /etc/ssl/private/midominio.key;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8091/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    # Swagger docs
    location /docs {
        proxy_pass http://127.0.0.1:8091/docs;
    }
}
```

### 5. Backups

La base de datos corre en el host (fuera de Docker), por lo que los backups se
hacen directamente con las herramientas de PostgreSQL del sistema:

```bash
# Backup de base de datos
pg_dump -h localhost -U estado_diario estado_diario > backup_$(date +%Y%m%d).sql

# Restaurar
psql -h localhost -U estado_diario -d estado_diario < backup.sql
```

### 6. Monitoreo

```bash
# Estado de servicios
docker-compose ps

# Logs en tiempo real
docker-compose logs -f --tail=100

# Uso de recursos
docker stats
```

## Consideraciones de Seguridad

1. Cambiar TODAS las contraseñas por defecto
2. Usar HTTPS en producción
3. Restringir acceso a pgAdmin (considerar deshabilitarlo en producción)
4. Configurar firewall para exponer solo puertos 80/443
5. Rotar el SECRET_KEY periódicamente
6. Configurar backups automáticos de PostgreSQL
