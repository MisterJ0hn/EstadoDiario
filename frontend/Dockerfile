# Stage 1: Build (Usando Debian Slim)
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

# Stage 2: Serve with Nginx (Usando Debian Slim ejecutado como root)
FROM nginx:slim

# 1. Copiar los archivos de Angular
COPY --from=build /app/dist/estado-diario-crm/browser /usr/share/nginx/html

# 2. Copiar tu configuración de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 3. Forzar explicitamente el puerto tradicional
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]