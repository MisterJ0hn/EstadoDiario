# Imagen de admin_app: la SPA de la consola de plataforma, servida por Nginx.
# Mismo esquema que frontend/, con una diferencia importante: acá el proxy
# /api/ apunta a admin_api (8092), no al backend de los estudios (8091). Son
# dos APIs distintas y no se pueden cruzar.

# Etapa 1: build
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

# Etapa 2: servir
FROM nginx:bookworm

COPY --from=build /app/dist/admin-app/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
