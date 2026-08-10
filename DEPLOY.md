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

# Ajustar CORS al dominio real
BACKEND_CORS_ORIGINS=https://midominio.cl

# Tokens
BACKEND_ACCESS_TOKEN_EXPIRE_MINUTES=15
BACKEND_REFRESH_TOKEN_EXPIRE_DAYS=7

# Logging
BACKEND_LOG_LEVEL=WARNING

# reCAPTCHA v3 — opcional; ver "Encender reCAPTCHA" más abajo.
# Vacías = apagado, y los formularios se comportan como si no existiera.
RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
```

### 2. Construir y Desplegar

```bash
docker-compose up -d --build
```

### 3. Verificar

```bash
docker-compose ps
curl http://localhost:8091/health   # backend de los estudios
curl http://localhost:8092/health   # admin_api (consola de plataforma)
```

Son **cuatro** servicios y no dos:

| Servicio | Puerto | Para quién |
|---|---|---|
| `backend` | 8091 | API de los estudios |
| `frontend` | 8090 | App de los estudios (se construye desde `ionic_app/`) |
| `admin_api` | 8092 | API de administración de la plataforma |
| `admin_app` | 8093 | Consola de administración |

**La app de los estudios sale de `ionic_app/`, no de `frontend/`.** Son la
misma aplicación —`ionic_app` es el port a Capacitor, con las mismas
pantallas— y publicar esa hace que la web y el Android salgan del mismo
código. Se compila con `--configuration web`, que es una configuración
distinta de la del APK: el APK necesita la URL absoluta de la API porque se
sirve desde el WebView, y la web necesita la relativa porque su propio Nginx
hace de proxy. Para volver a servir `frontend/`, cambiar el `context` de ese
servicio en el compose.

Las dos APIs están separadas a propósito: el token de la consola lleva
`ambito=sistema` y el de un estudio `ambito=cliente`, y cada servicio rechaza
con 403 el del otro. **No las pongas detrás del mismo `location /api/`**: una
sesión de estudio no debe siquiera poder alcanzar los endpoints de la consola.

La imagen de `admin_api` se construye con el repositorio completo como
contexto (`context: .`), porque reutiliza `backend/app` en vez de duplicar los
modelos, el cifrado y el esquema de las bases de cliente. Si le pones un
contexto acotado a `admin_api/`, el contenedor arranca y aborta diciéndolo.

`BACKEND_SECRET_KEY` tiene que ser **la misma** en `backend` y en `admin_api`:
además de firmar los tokens es la semilla del cifrado de RUTs y del hash de
búsqueda. Con claves distintas, un cliente creado desde la consola queda con
datos que el backend no puede descifrar, y no da error hasta que alguien
intenta leerlos.

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

La consola va en **otro nombre de host**, no en una ruta de este. Colgarla de
`/admin` la deja compartiendo origen con la app de los estudios, y ahí un XSS
en cualquier pantalla de cliente alcanza el token de administración de la
plataforma.

```nginx
server {
    listen 443 ssl;
    server_name admin.midominio.cl;

    ssl_certificate /etc/ssl/certs/midominio.crt;
    ssl_certificate_key /etc/ssl/private/midominio.key;

    # El contenedor admin_app ya sirve la SPA y redirige /api/ a admin_api,
    # así que acá basta con un solo location.
    location / {
        proxy_pass http://127.0.0.1:8093;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Con este esquema el puerto 8092 no necesita quedar expuesto hacia afuera: la
consola habla con `admin_api` por la red interna de Docker. Si igual lo
publicas para un navegador, hay que agregar ese origen a
`ADMIN_API_CORS_ORIGINS`.

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

## Encender reCAPTCHA

Protege los cuatro formularios que se pueden usar sin sesión: los dos logins,
`recuperar-password` y `restablecer-password`. Es **opcional**: mientras las
llaves estén vacías el sistema no llama a Google y todo funciona como si no
existiera.

Se estrena en dos etapas, y saltarse la primera es la forma conocida de dejar
gente afuera.

**Etapa 1 — medir sin bloquear.** Crear un par de llaves **v3** en
<https://www.google.com/recaptcha/admin>, registrando el dominio que sirve las
SPA. Después:

```env
RECAPTCHA_SITE_KEY=<la site key>
RECAPTCHA_SECRET_KEY=<el secret>
RECAPTCHA_SOLO_REGISTRAR=true
```

Las mismas llaves van a `backend` y a `admin_api` — `docker-compose.yml` ya las
pasa a los dos desde el `.env`. Un par distinto en cada uno haría fallar el
100% de los ingresos.

En este modo se verifica y se registra, pero **no se rechaza a nadie**. Hay que
dejarlo así una semana y contar dos cosas en el log:

```bash
docker-compose logs backend | grep "reCAPTCHA rechazó" | grep -c "motivo=sin_token"
docker-compose logs backend | grep "reCAPTCHA rechazó" | grep -c "motivo=puntaje_bajo"
```

`sin_token` es tráfico legítimo que se quedaría afuera al encender: la app
Android, los bloqueadores de contenido y los proxies corporativos, que en
estudios jurídicos son frecuentes. `puntaje_bajo` dice si el umbral está bien
para la gente real.

**Etapa 2 — encender.** Con esos números a la vista se ajusta el umbral y se
saca el modo monitor:

```env
RECAPTCHA_SCORE_MINIMO=0.5
RECAPTCHA_SOLO_REGISTRAR=false
```

`docker-compose up -d` y listo; no hay que reconstruir ninguna imagen de
Angular, porque la site key la sirve el backend en `GET /api/v1/auth/recaptcha`.

**Lo que hay que saber antes de encender:**

- **La app Android deja de poder iniciar sesión.** Su WebView corre desde el
  origen `https://localhost`, que no está registrado en la consola, así que no
  puede acuñar tokens. Si el conteo de `sin_token` de la etapa 1 muestra
  tráfico de APK, hay que resolver eso primero.
- **Si Google no responde, se deja pasar.** Es deliberado: lo contrario cambia
  una caída de Google por una caída total del producto, en la que ni el
  administrador puede entrar a arreglarla. Se ve en el log como
  `no concluyente ... DEJA PASAR`. Para invertirlo mientras dure un ataque:
  `RECAPTCHA_FALLA_ABIERTA=false`.
- **El umbral no se puede calibrar en desarrollo**: en localhost Google
  devuelve casi siempre 0.9.

**Apagar** es vaciar las dos llaves y reiniciar. No hay estado que limpiar.

## Consideraciones de Seguridad

1. Cambiar TODAS las contraseñas por defecto
2. Usar HTTPS en producción
3. No exponer el puerto 5432 del host a Internet: `listen_addresses` y las
   reglas de firewall deben limitarlo a la red de Docker (`172.16.0.0/12`)
4. Configurar firewall para exponer solo puertos 80/443
5. Rotar el SECRET_KEY periódicamente
6. Configurar backups automáticos de PostgreSQL
