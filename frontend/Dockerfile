# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

# Stage 2: Serve with Nginx
FROM nginx:alpine

# 1. Modificar el archivo de configuración maestro de Nginx para usar /tmp/nginx.pid de forma global
USER root
RUN sed -i 's|/var/run/nginx.pid|/tmp/nginx.pid|g' /etc/nginx/nginx.conf
COPY --from=build /app/dist/estado-diario-crm/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Crear el archivo PID y dar permisos al usuario nginx en las rutas necesarias
RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

# Cambiar al usuario sin privilegios antes de correr Nginx
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
