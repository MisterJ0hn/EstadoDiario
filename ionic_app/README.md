# Estado Diario — app móvil (Ionic + Capacitor)

Cliente **para los estudios**, en Android y web, con el mismo diseño que el
frontend Angular.

No incluye la consola de administración de la plataforma (crear clientes,
SMTP/Google/WhatsApp del sistema): eso se sigue usando desde el navegador, en
`frontend/`.

## Cómo está armado

Es el mismo proyecto Angular 19 del frontend, con Ionic encima. Eso no es
casualidad ni pereza: el objetivo era **réplica fiel**, y reescribir 28
pantallas habría garantizado que se fueran separando con el tiempo.

- `src/app/core/` — servicios, modelos, guards e interceptores: **idénticos**
  al frontend. Si cambia un contrato de la API, se copia el archivo y listo.
- `src/app/features/` — las pantallas, con sus plantillas Tailwind tal cual.
- De Ionic se usa solo el armazón (`ion-app`, `ion-router-outlet`) y su CSS
  estructural. **No** se importan sus temas de color ni de tipografía: pisarían
  el design system y la app dejaría de verse como Estado Diario.

Lo que sí es distinto del frontend web está marcado en el código y es poco:
descarga de archivos, selector de archivos, botón atrás y URL de la API.

## Correr en desarrollo (web)

```bash
npm install
npm start            # http://localhost:4300
```

Apunta a `http://localhost:8091/api/v1` (ver `src/environments/environment.ts`).

El backend tiene que aceptar ese origen o el navegador bloquea todo por CORS:

```bash
BACKEND_CORS_ORIGINS="http://localhost:4200,http://localhost:4300" \
  python -m uvicorn app.main:app --port 8091
```

Para probar desde un teléfono en la misma red, cambiar `apiUrl` a la IP del
equipo (`http://192.168.x.x:8091/api/v1`): dentro del teléfono, `localhost` es
el teléfono.

## Android

```bash
npm run sync         # build de producción + copia a android/
npx cap open android # abre Android Studio
```

Desde Android Studio: **Run** para instalar en un dispositivo o emulador, y
`Build > Build Bundle(s)/APK(s)` para generar el APK.

Cada vez que se cambie código web hay que volver a correr `npm run sync`: el
APK lleva la build dentro, no la toma en vivo.

### Lo que hay que saber del despliegue actual

- La API va en **http, no https** (`http://edapi.temposoft.cl`). Android 9+
  bloquea el tráfico en claro, así que hay una excepción **por dominio** en
  `android/app/src/main/res/xml/network_security_config.xml`. Cuando la API
  tenga certificado: cambiar `apiUrl` a `https://`, borrar ese archivo y quitar
  `android:networkSecurityConfig` del `AndroidManifest.xml`.
- Android **no pasa por CORS**; la build web servida desde otro origen sí, y
  hay que agregar ese origen a `BACKEND_CORS_ORIGINS`.
- El emulador ve al equipo de desarrollo como `10.0.2.2`, no `localhost`. Ya
  está contemplado en la excepción de red.

## Lo que se adaptó para móvil

Cuatro cosas, todas por fallas reales del WebView y no por gusto:

**Descarga de reportes** (`core/utils/descarga.ts`). `<a download>` no hace
nada dentro del WebView: el archivo no se guarda y tampoco aparece un error, así
que quien aprieta "Descargar" se queda mirando una pantalla que no responde. En
Android el Excel se escribe con Filesystem y se abre la hoja de compartir. En
web sigue igual que siempre.

**Selector de archivos** (`upload-form`). El `accept` lleva los tipos MIME
además de las extensiones: el selector de Android filtra por MIME y con solo
`.xls` deja todos los archivos en gris, sin poder elegir ninguno.

**Botón atrás de Android** (`app.component.ts`). Por defecto cierra la app en la
primera pantalla; ahora minimiza, como las apps del sistema. En el login sí sale.

**Áreas seguras** (`styles.css`). Padding por las variables de Ionic para que el
encabezado no quede bajo la barra de estado en teléfonos con notch. En web valen
0 y no cambian nada.

## Mantener las dos apps sincronizadas

Al tocar el frontend web, lo de `core/` se copia sin pensar. En `features/` casi
siempre también, salvo estos archivos, que **divergen a propósito**:

| Archivo | Por qué difiere |
|---|---|
| `core/utils/descarga.ts` | Filesystem + Share en nativo |
| `app.component.ts` | `ion-app` y el botón atrás |
| `app.config.ts` | `provideIonicAngular` |
| `app.routes.ts` | sin las rutas de la consola de plataforma |
| `features/layout/layout.component.ts` | sin el menú de plataforma |
| `features/auth/login.component.ts` | sin el ingreso de administrador |
| `features/estado-diario/.../upload-form.component.ts` | `accept` con MIME |
| `styles.css` | CSS de Ionic + áreas seguras |
| `environments/*` | la URL de la API tiene que ser absoluta |
