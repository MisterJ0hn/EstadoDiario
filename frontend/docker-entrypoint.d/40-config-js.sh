#!/bin/sh
# Escribe config.js con la URL de la API que se pidió en el .env, para poder
# cambiarla sin recompilar la app. Lo ejecuta el entrypoint de la imagen de
# nginx antes de arrancar, igual que sus propios scripts de /docker-entrypoint.d/.
#
# FRONTEND_API_URL vacía (lo normal) = no se escribe nada y la app usa la ruta
# relativa /api/v1, que este mismo nginx manda al backend.
set -eu

destino=/usr/share/nginx/html/config.js
url="${API_URL:-}"

# Fuera la barra final: la app concatena `${apiUrl}/auth/...`.
url="${url%/}"

if [ -z "$url" ]; then
  echo 'window.__ED_CONFIG__ = {};' > "$destino"
  echo "40-config-js: sin API_URL, la app usa /api/v1 (mismo origen)"
else
  # Se escapan \ y " para que el valor no pueda salirse del literal JS.
  escapada=$(printf '%s' "$url" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
  printf 'window.__ED_CONFIG__ = { apiUrl: "%s" };\n' "$escapada" > "$destino"
  echo "40-config-js: la app usa $url"
fi
