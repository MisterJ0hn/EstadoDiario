# Consola de administración — SPA Angular

Administra los **clientes** de la plataforma: altas, aprovisionamiento de su
base de datos, suspensión, casilla de ingesta, usuarios y configuración del
sistema.

Es una **SPA Angular y nada más**: archivos estáticos que corren en el
navegador. No abre conexiones a PostgreSQL, no cifra nada, no tiene proceso de
servidor propio. Todo lo pide por HTTP a **`admin_api/`** (FastAPI, Python,
puerto **8092**), que es donde vive la lógica y el acceso a la base.

Antes esto era un monolito: un proceso Node servía la aplicación renderizada en
servidor **y** una API en Express que hablaba con PostgreSQL. Esa mitad se fue
entera a `admin_api/`.

## Qué implica que la API esté afuera

**CORS es obligatorio ahora.** Cuando eran el mismo proceso, la SPA pedía a
`/api/v1` y el navegador ni preguntaba. Hoy la SPA se sirve desde un origen (el
dev-server en `http://localhost:4401`, o donde se publique el build) y la API
está en otro (`http://localhost:8092`). `admin_api` tiene que permitir ese
origen, responder el preflight `OPTIONS` y aceptar el encabezado
`Authorization` que agrega el interceptor. Si la consola "no carga nada" y la
consola del navegador habla de CORS, el problema está allá, no acá.

**La URL de la API se configura en un solo lugar:** `src/environments/`. Al
publicar en un servidor real hay que cambiarla junto con la lista de orígenes
permitidos en `admin_api`; son dos ajustes que van siempre en pareja.

**El contrato no cambió.** Las rutas siguen siendo `/api/v1/auth/...` y
`/api/v1/admin/...`, las mismas que servía el Express. Los servicios de
`src/app/features/**` no se tocaron al migrar.

## Ya no hay SSR

La aplicación se renderizaba en servidor. Se sacó junto con el monolito, y con
eso desaparecieron `src/server.ts`, `src/main.server.ts`,
`app.config.server.ts`, `provideClientHydration` y las opciones `ssr`,
`prerender`, `server` y `outputMode` de `angular.json`.

Cabo suelto que conviene entender: `core/utils/almacenamiento.ts` **existía**
porque `localStorage` no existe en Node y cualquier lectura de la sesión
reventaba el render. Esa razón ya no aplica, pero el archivo se conservó por
otra que sí sigue viva: `localStorage` puede lanzar aunque exista (modo privado,
cookies de terceros bloqueadas, cuota llena). Ante el fallo, leer devuelve
`null` y escribir se descarta en silencio; la sesión sobrevive en memoria hasta
recargar. Es mejor que una pantalla en blanco.

## Es la única forma de administrar la plataforma

El backend de los estudios (`backend/`) ya no expone `/api/v1/admin/*`, ni
`auth/admin`, ni los ajustes de Google/WhatsApp: responden 404. Lo que sí
conserva, porque es suyo: leer clientes y configuraciones para rutear la
ingesta y los envíos, el job de purga nocturno y el de migración.

## Correr

```bash
npm install
npm start          # dev-server en http://localhost:4401
```

Para el build de producción:

```bash
npm run build      # -> dist/admin-app/browser/
```

Eso deja archivos estáticos: se sirven con cualquier servidor web (nginx, Caddy,
`python -m http.server`…). Como es una SPA con rutas de cliente, el servidor
tiene que devolver `index.html` para cualquier ruta que no sea un archivo, o
recargar en `/clientes` da 404.

`admin_api` se levanta aparte; sus variables de entorno (conexión a PostgreSQL,
`BACKEND_SECRET_KEY`, prefijo de las bases de los clientes) están documentadas
en su propio README. Acá no hace falta ninguna.

## Cómo está organizado

```
src/
  app/
    features/admin/          dashboard, clientes, ficha, configuración
    features/auth/           login de plataforma y cambio de clave
    features/configuracion/  SMTP, Google Calendar, WhatsApp
    features/layout/         armazón con la barra lateral
    core/                    servicios, modelos, guards, interceptores
  environments/              apiUrl -> admin_api
```
