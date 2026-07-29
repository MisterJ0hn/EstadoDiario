# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist/estado-diario-crm/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Crear el archivo PID y dar permisos al usuario nginx en las rutas necesarias
USER root
RUN touch /tmp/nginx.pid && \
    chown -R nginx:nginx /tmp/nginx.pid /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

# Cambiar al usuario sin privilegios antes de correr Nginx
USER nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
