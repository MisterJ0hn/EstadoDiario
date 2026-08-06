# Imagen de admin_api (consola de plataforma, FastAPI).
#
# OJO CON EL CONTEXTO: se construye desde la RAÍZ del repositorio, no desde
# admin_api/. El servicio importa el paquete `app` de backend/ (modelos,
# cifrado, esquema de las bases de cliente), así que la imagen tiene que
# incluir ese directorio. En docker-compose:
#
#   build:
#     context: .
#     dockerfile: admin_api/Dockerfile
#
FROM python:3.12-slim

# No es /app a propósito: acá dentro conviven backend/app y admin_api/app, y
# un WORKDIR llamado igual que el paquete solo confunde al leer el árbol.
WORKDIR /srv

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Los dos requirements: el de admin_api incluye al del backend por referencia
# (-r ../backend/requirements.txt), así que ambos tienen que estar antes de
# instalar. Van solos en esta capa para no reinstalar en cada cambio de código.
COPY backend/requirements.txt ./backend/requirements.txt
COPY admin_api/requirements.txt ./admin_api/requirements.txt
RUN pip install --no-cache-dir -r admin_api/requirements.txt

# El paquete compartido. Sin esto el servicio aborta al arrancar diciéndolo.
COPY backend/app ./backend/app
COPY admin_api ./admin_api

EXPOSE 8000

# Desde /srv y como admin_api.app.main: parado dentro de admin_api/, `app`
# resolvería a SU propio paquete y no al de backend/.
CMD ["uvicorn", "admin_api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
