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

# 3. Forzar el puerto tradicional ejecutándose como Root para evitar el bug del kernel viejo
USER root

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]