# Manual de Despliegue - Estado Diario CRM

## Despliegue en Producción

### 1. Preparar Variables de Entorno

```bash
cp .env.example .env
```

Editar `.env` con valores de producción:

```env
APP_ENV=production

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

```bash
# Backup de base de datos
docker exec ed_postgres pg_dump -U estado_diario_user estado_diario_db > backup_$(date +%Y%m%d).sql

# Restaurar
cat backup.sql | docker exec -i ed_postgres psql -U estado_diario_user -d estado_diario_db
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
