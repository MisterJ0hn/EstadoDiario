# Stage 1: Build (Usando Debian Slim oficial)
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

# Stage 2: Serve with Nginx (Usando Debian Slim oficial para Nginx)
FROM nginx:bookworm

# 1. Copiar los archivos de Angular
COPY --from=build /app/dist/estado-diario-crm/browser /usr/share/nginx/html

# 2. Copiar tu configuración de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Escribe config.js con FRONTEND_API_URL al arrancar (ver environment.prod.ts).
# El sed quita los \r por si el archivo se editó en Windows: con ellos el
# shebang falla y el contenedor no arranca.
COPY docker-entrypoint.d/40-config-js.sh /docker-entrypoint.d/40-config-js.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-config-js.sh \
 && chmod +x /docker-entrypoint.d/40-config-js.sh

# 3. Forzar el puerto tradicional ejecutándose como Root para evitar el bug del kernel viejo

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]