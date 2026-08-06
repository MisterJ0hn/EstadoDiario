# Imagen web de ionic_app: la app de los estudios servida por Nginx.
#
# DOS DIFERENCIAS con frontend/Dockerfile que no son cosméticas:
#
# 1. Se compila con `--configuration web`, NO con `production`. La de
#    producción es la del APK y lleva la URL absoluta de la API; acá hace falta
#    la relativa, porque este mismo Nginx hace de proxy (ver nginx.conf).
#    Compilar con production dejaría la web pegándole a edapi.temposoft.cl y
#    dependiendo de CORS.
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

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
