# Imagen web de ionic_app: la app de los estudios servida por Nginx.
#
# DOS DIFERENCIAS con frontend/Dockerfile que no son cosméticas:
#
# 1. Se compila con `--configuration web`, NO con `production`. La de
#    producción es la del APK y lleva la URL absoluta de la API; acá hace falta
#    la relativa por defecto, porque este mismo Nginx hace de proxy (ver
#    nginx.conf). Compilar con production dejaría la web pegándole a
#    edapi.temposoft.cl y dependiendo de CORS. Si hace falta otra URL no se
#    recompila: se pone FRONTEND_API_URL en el .env (ver environment.web.ts).
# 2. La salida es `www/` a secas y no `dist/<proyecto>/browser`: el
#    outputPath de este proyecto es {base: "www", browser: ""}, para que
#    Capacitor encuentre los archivos donde los espera.

# Etapa 1: build
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:web

# Etapa 2: servir
FROM nginx:bookworm

COPY --from=build /app/www /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Escribe config.js con FRONTEND_API_URL al arrancar (ver environment.web.ts).
# El sed quita los \r por si el archivo se editó en Windows: con ellos el
# shebang falla y el contenedor no arranca.
COPY docker-entrypoint.d/40-config-js.sh /docker-entrypoint.d/40-config-js.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-config-js.sh \
 && chmod +x /docker-entrypoint.d/40-config-js.sh

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
