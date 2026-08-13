# Manual de Instalación - Estado Diario CRM

## Requisitos Previos

- **Docker** >= 24.0
- **Docker Compose** >= 2.20
- **Git**
- **PostgreSQL >= 14 instalado en el host Linux** (NO se levanta en Docker)

## Preparar PostgreSQL del Host

El `docker-compose.yml` **no** incluye un contenedor de PostgreSQL: los servicios
se conectan al PostgreSQL instalado en la máquina Linux anfitriona a través de
`host.docker.internal` (resuelto con `extra_hosts: host-gateway`).

```bash
# 1. Crear usuario y base de datos PRINCIPAL
#    CREATEDB no es opcional: el sistema crea una base de datos por cada
#    cliente que se da de alta (estado_diario_<guid>). Sin ese permiso el
#    alta falla y el cliente queda en estado "error".
sudo -u postgres psql <<'SQL'
CREATE USER estado_diario WITH PASSWORD 'Estado123' CREATEDB;
CREATE DATABASE estado_diario OWNER estado_diario;
SQL

# 2. Permitir que PostgreSQL escuche en la interfaz del bridge de Docker
#    /etc/postgresql/<version>/main/postgresql.conf
listen_addresses = '*'          # o 'localhost,172.17.0.1'

# 3. Autorizar la red de Docker en pg_hba.conf
#    /etc/postgresql/<version>/main/pg_hba.conf
host    all    all    172.16.0.0/12    scram-sha-256

# 4. Reiniciar el servicio
sudo systemctl restart postgresql

# 5. Si hay firewall activo, abrir el puerto solo para la red de Docker
sudo ufw allow from 172.16.0.0/12 to any port 5432 proto tcp
```

## Instalación Rápida

```bash
# 1. Clonar el repositorio
cd C:\sitios\temposoft\estado_diario

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Editar .env con los datos del PostgreSQL del host
#    (POSTGRES_HOST=host.docker.internal, usuario, password, puertos)

# 4. Levantar todos los servicios
docker-compose up -d --build

# 5. Verificar que los servicios estén corriendo
docker-compose ps

# 6. Verificar la conexión a la BD del host desde el backend
docker exec ed_backend python -c "import socket; socket.create_connection(('host.docker.internal', 5432), 5); print('OK')"
```

## Servicios y Puertos

| Servicio   | Puerto | URL                          |
|------------|--------|------------------------------|
| Frontend   | 8090   | http://localhost:8090         |
| Backend    | 8091   | http://localhost:8091         |
| Swagger    | 8091   | http://localhost:8091/docs    |
| ReDoc      | 8091   | http://localhost:8091/redoc   |
| PostgreSQL | 5432   | localhost:5432 (servicio del host, fuera de Docker) |

> Solo hay dos contenedores: `ed_backend` y `ed_frontend`. PostgreSQL y pgAdmin
> son responsabilidad del host.

## Primer Ingreso

Hay **dos inicios de sesión distintos**:

| Quién                          | Campos                    | Qué administra                    |
|--------------------------------|---------------------------|-----------------------------------|
| Administrador de la plataforma | usuario + contraseña      | Los clientes (estudios) y el sistema |
| Usuario de un estudio          | RUT + usuario + contraseña| Las causas de su estudio          |

En el primer arranque se siembra un solo administrador de plataforma, con la
clave de `ADMIN_INICIAL_USUARIO` / `ADMIN_INICIAL_PASSWORD` del `.env` (por
defecto `admin` / `admin123`). Nace con la clave marcada como provisoria: entra,
pero **ningún otro endpoint de administración responde** hasta cambiarla.

Después:

1. Cambiar esa contraseña.
2. **Clientes → Nuevo**: nombre y RUT del estudio. El backend crea su base de
   datos; toma unos segundos y el estado se ve en la ficha.
3. Con la base en `listo`, crear los usuarios del estudio desde su ficha. Nacen
   con clave provisoria: la persona la cambia al entrar.

El RUT del cliente es la credencial con la que su gente inicia sesión, y no se
puede cambiar después.

### PostgreSQL (instalado en el host Linux)
- **Host**: host.docker.internal (desde los contenedores) / localhost (desde el host)
- **Puerto**: 5432
- **Base principal**: estado_diario
- **Base de cada cliente**: estado_diario_&lt;guid&gt; (las crea el sistema)
- **Usuario**: estado_diario (con CREATEDB)
- **Password**: Estado123

## Migrar una Instalación Anterior

Si ya había una instalación de la versión de una sola base, hay que convertirla
en el primer cliente **antes** de levantar el backend nuevo contra ella:

```bash
# En seco primero: cuenta lo que movería sin escribir nada
docker exec ed_backend python -m app.jobs.migrar_a_multitenant \
    --nombre "Estudio X" --rut 76543210-K --ensayo

# Real
docker exec ed_backend python -m app.jobs.migrar_a_multitenant \
    --nombre "Estudio X" --rut 76543210-K --correo contacto@estudio.cl
```

Copia usuarios y datos a la base del cliente conservando los id, y deja las
tablas viejas en la base principal con el prefijo `_legacy_` — no borra nada.
Las contraseñas siguen siendo las mismas; lo que cambia es que ahora hay que
indicar el RUT del estudio al iniciar sesión. Detalles en `ARCHITECTURE.md`.

## Administrar la Base de Datos

pgAdmin ya no forma parte del `docker-compose.yml`. Como PostgreSQL corre en el
host, se administra directamente desde ahí:

```bash
# Cliente de línea de comandos
psql -h localhost -U estado_diario -d estado_diario
```

Si prefieres interfaz gráfica, instala pgAdmin nativo en el host y conéctalo a
`localhost:5432`:

```bash
# Debian/Ubuntu
sudo apt install -y pgadmin4-desktop     # o pgadmin4-web
```

## Importación por Correo (opcional)

El sistema puede bajar solo los adjuntos de estado diario desde una casilla
IMAP. Hay **una casilla por cliente** y lo que llegue a ella se importa en la
base de ese cliente: la casilla es lo que amarra un correo entrante a una base.

**La configura la plataforma**, en la ficha del cliente: de qué casilla se lee
determina en qué base entra cada archivo, así que no es decisión del estudio. La
casilla por defecto de un cliente es `<guid>@temposoft.cl`.

El estudio ve la ingesta en modo lectura (**Administración → Bitácora de
Correo**, solo su administrador): si hoy llegó el estado diario o no.

### Gmail

Gmail se conecta como IMAP estándar; no requiere OAuth ni proyecto en Google
Cloud. Necesita una **contraseña de aplicación**:

1. Activar la verificación en dos pasos en la cuenta de Google.
2. Ir a https://myaccount.google.com/apppasswords y generar una contraseña.
3. En la pantalla de configuración usar `imap.gmail.com`, puerto `993`, SSL, y
   esa contraseña (no la de la cuenta).

En cuentas de Google Workspace el administrador puede tener bloqueadas las
contraseñas de aplicación; en ese caso hay que habilitarlas primero.

### Clave de cifrado

La contraseña de la casilla se guarda cifrada. Conviene fijar una clave propia
en el `.env` antes de configurarla:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# copiar el resultado a MAIL_ENCRYPTION_KEY en .env
```

Si se cambia `MAIL_ENCRYPTION_KEY` (o `BACKEND_SECRET_KEY`, de la que se deriva
cuando la primera está vacía), hay que volver a escribir la contraseña en la UI.

### Frecuencia de revisión

**La casilla se revisa en cada pasada del cron**, no una vez al día: el estado
diario del PJUD no llega siempre a la misma hora, y una revisión única deja sin
importar todo lo que llegue después. La frecuencia la fija el crontab: con la
línea de abajo, cada 15 minutos; con `0 * * * *`, cada hora.

Lo que la UI llama **"Revisar desde las"** es un piso, no una cita: antes de esa
hora no se revisa, desde ella se revisa en cada pasada. Dejarla vacía es una
opción legítima y significa "todo el día".

Revisar de más no duplica nada. Hay cuatro barreras independientes: el IMAP se
consulta con `UNSEEN`, lo procesado queda marcado como leído, el log descarta el
adjunto ya importado (por `message_id` + nombre) y los importadores rechazan un
archivo con el mismo RUT, fecha y tipo.

```bash
# crontab -e  en el host
*/15 * * * * docker exec ed_backend python -m app.jobs.revisar_correo >> /var/log/estado_diario_correo.log 2>&1
```

Para probarlo de inmediato, ignorando la hora configurada:

```bash
docker exec ed_backend python -m app.jobs.revisar_correo --forzar
```

Todo lo que ocurre queda en **Bitácora de Correo**, incluidos los mensajes
descartados y los días en que no llegó ningún archivo.

## Permisos dentro de un estudio

El administrador de cada estudio reparte visibilidad en **Administración →
Usuarios y permisos**: qué jurisdicciones ve cada integrante.

**Sin nada asignado, la persona ve todas.** Es deliberado: un estudio que nunca
abrió esa pantalla sigue funcionando igual, y nadie queda con el sistema en
blanco sin saber por qué. Para cortarle el acceso a alguien se desactiva su
cuenta, lo que sí dice qué pasó — eso lo hace la plataforma, no el estudio.

Las causas que el sistema no logró clasificar en ninguna jurisdicción las ven
todos, para que no desaparezcan sin que nadie lo note.

## Recordatorios: Google Calendar y WhatsApp (opcional)

Cada abogado conecta su propio Google Calendar desde **Mi Perfil** (OAuth
individual, sin organización de Google Workspace). El administrador
configura las credenciales del proyecto de Google y de Twilio desde
**Administración → Google Calendar** y **Administración → WhatsApp**; ambas
viven en la base de datos, cifradas, igual que la contraseña de correo — no
van en el `.env`.

Variables de entorno necesarias: solo `PUBLIC_BASE_URL` (la URL pública del
sitio, sin barra final), usada para armar el redirect URI de Google
(`PUBLIC_BASE_URL/api/v1/google-calendar/callback`) — hay que registrar ese
mismo redirect URI en la consola de Google Cloud al crear el Client ID.

**Importante para producción**: al ser una app sin organización de Google
Workspace, mientras el proyecto de Google Cloud esté en modo *Testing* los
`refresh_token` caducan a los 7 días y cada abogado tendría que reconectar
semanalmente. Hay que publicar la app (*In production* en la pantalla de
consentimiento OAuth) para uso real; sin verificar ante Google se muestra un
aviso "app no verificada" (se puede continuar) y hay un tope aproximado de
100 cuentas conectadas.

Envío de WhatsApp — cron cada 5 minutos, revisa qué recordatorios ya
llegaron a su fecha/hora de envío:

```bash
# crontab -e  en el host
*/5 * * * * docker exec ed_backend python -m app.jobs.enviar_recordatorios_whatsapp >> /var/log/estado_diario_whatsapp.log 2>&1
```

Requiere una cuenta Twilio con WhatsApp Business aprobado y una plantilla de
mensaje ya aprobada (Content SID), pegados en **Administración → WhatsApp**.

## reCAPTCHA (opcional)

Protege de bots los cuatro formularios que se pueden usar sin sesión: los dos
inicios de sesión, la recuperación de contraseña y el restablecimiento.

**Viene apagado y el sistema funciona igual sin él.** Mientras las llaves estén
vacías no se llama a Google y no cambia nada; no hace falta tocarlo para
instalar ni para desarrollar.

Para encenderlo, crear un par de llaves **v3** (no v2) en
<https://www.google.com/recaptcha/admin>, registrar el dominio del sitio, y
ponerlas en el `.env`:

```env
RECAPTCHA_SITE_KEY=<la site key>
RECAPTCHA_SECRET_KEY=<el secret>
```

Van a los dos servicios y tienen que ser las mismas; `docker-compose.yml` ya se
encarga. No hay que recompilar las aplicaciones Angular: la site key la
entregan `GET /api/v1/auth/recaptcha` de cada API.

En producción **hay que estrenarlo en modo monitor** antes de bloquear a
nadie. El procedimiento completo y por qué está en `DEPLOY.md`, sección
"Encender reCAPTCHA".

Para desarrollo conviene un par de llaves aparte con `localhost` registrado:
meter `localhost` en la llave de producción degrada los puntajes reales.

### La app Android necesita su propio par

El APK corre en un WebView cuyo origen es `https://localhost`. Ese dominio no
está registrado en la llave del sitio —y registrarlo ahí degradaría los
puntajes reales de la web— así que sin llaves propias la app **no puede acuñar
tokens y su login queda rechazado**.

Se resuelve con un segundo par v3, con `localhost` en su lista de dominios:

```env
RECAPTCHA_SITE_KEY_APP=<site key del par de la app>
RECAPTCHA_SECRET_KEY_APP=<su secret>
```

El backend elige el par mirando el `Origin` de cada petición, y con el mismo
criterio en las dos mitades: la que sirve la site key por
`GET /api/v1/auth/recaptcha` y la que verifica el token. **No hay que tocar
nada en las apps**: ese encabezado lo pone el navegador.

Con el par vacío —o a medias— todo usa la llave de la web, que es como se
comportaba antes de que esto existiera.

**Ojo con el tipo de clave.** En la consola de Google hay que crear una de tipo
**sitio web (v3)**, que entrega *site key + secret*. Una clave de tipo
**Android** entrega solo un identificador y no sirve acá: se verifica contra la
API de *assessments* de reCAPTCHA Enterprise y exige el SDK nativo de Android,
que esta app —un WebView— no usa.

## Purga de la Bitácora

`log_actividades` registra una fila por acción y crece rápido. Resolver un
movimiento y dejarlo pendiente también quedan registrados (`marcar_leido` y
`marcar_pendiente`), y son las acciones más frecuentes del día a día: en un
estudio con movimiento alto la bitácora crece varios miles de filas al mes, así
que la purga no es opcional. La política de
permanencia se fija en **Administración de la plataforma → Sistema** (con
override por cliente en su ficha) y la aplica un job nocturno, base por base:

```bash
# crontab -e  en el host
30 3 * * * docker exec ed_backend python -m app.jobs.purgar_logs >> /var/log/estado_diario_purga.log 2>&1
```

## Cruce de los reportes contra Mis Causas

Los tres Excel del PJUD hablan de las mismas causas y ninguno las trae todas. El
sistema las cruza para mantener `causa` y `causa_corte` al día: rellena campos
vacíos, actualiza el estado y agrega lo que la cartera no tenga.

**Corre solo, al cerrar cada importación.** No hay que hacer nada: cada Excel que
entra —por correo o subido a mano— dispara el cruce en su misma transacción.

Para lo que ya estaba cargado antes de esta versión, hay un job de reconstrucción:

```bash
# Ver qué haría, sin escribir nada
docker exec ed_backend python -m app.jobs.sincronizar_cartera --simular
# Aplicarlo a todos los clientes
docker exec ed_backend python -m app.jobs.sincronizar_cartera
# Un solo cliente
docker exec ed_backend python -m app.jobs.sincronizar_cartera --guid <guid>
```

Es idempotente: correrlo dos veces no cambia nada la segunda. Conviene dejarlo
también en el crontab por si alguna importación quedó a medias:

```bash
15 2 * * * docker exec ed_backend python -m app.jobs.sincronizar_cartera >> /var/log/estado_diario_cartera.log 2>&1
```

Dos cosas que conviene saber al mirar el resultado:

- **El estado casi siempre lo mueve Movimientos.** El estado diario solo trae esa
  columna en Penal y Familia, y en Corte no la trae nunca. Buscar ahí un estado
  que no llega es perder el tiempo.
- **Las filas sin tribunal se omiten y se informan.** La causa se identifica por
  `rol + tribunal`; sin las dos partes no hay con qué cruzar. Si el job reporta
  muchas omitidas, suele ser dato mal clasificado por el importador antiguo.

Una causa agregada por el cruce **se factura igual que las demás**. Queda marcada
con `origen_dato` para poder explicar de dónde salió.

## Suspensión automática por mora

Un cliente con facturas impagas se suspende solo pasados N días desde la emisión
de la más antigua. El plazo se fija en **Administración → Configuración**, no en
el código: es una decisión comercial.

**Viene apagada** (`0 días`). Suspender es lo más agresivo que hace el sistema
—los abogados del estudio no pueden entrar, la ingesta por correo lo salta y no
salen sus recordatorios— así que no puede empezar a ocurrir porque alguien
desplegó una versión nueva. La pantalla de configuración avisa a cuántos
clientes afectaría el plazo guardado antes de que nadie lo aplique.

```bash
# Ver a quién suspendería, sin tocar nada
docker exec ed_backend python -m app.jobs.suspender_morosos --simular
# Aplicarlo
docker exec ed_backend python -m app.jobs.suspender_morosos

# En el crontab del host, una vez al día
30 5 * * * docker exec ed_backend python -m app.jobs.suspender_morosos >> /var/log/estado_diario_mora.log 2>&1
```

Dos cosas que conviene saber:

- **Se cuenta desde la emisión**, porque la factura no lleva fecha de
  vencimiento: es el único dato que consta.
- **Nadie se reactiva solo.** Pagar no levanta la suspensión: un cliente puede
  estar suspendido por otro motivo, y revertirlo automáticamente sería deshacer
  una decisión que no se tomó ahí. Reactivar sigue siendo manual, desde Clientes.

El botón de suspender a mano quedó oculto en la consola. El código y su modal
siguen en su sitio: para volver a habilitarlo se cambia una condición en
`clientes-list.component.ts`.

## Facturación Mensual

Se cobra por cantidad de causas de la cartera vigente: una línea por materia
(Civil, Cobranza, Familia, Laboral, Penal), más Corte de Apelaciones y Corte
Suprema. El precio de cada concepto sale de las **tarifas del cliente**
(`tarifa_cliente`), y un concepto sin fila se cobra al valor por defecto de la
plataforma: $1 por causa de materia, $2 por Apelaciones y $3 por Suprema.

El día 1 de cada mes un job genera la factura del mes que terminó, cliente por
cliente, y la escribe con su detalle en `factura` + `factura_detalle` (base
principal). **No es una consulta que se pueda repetir después**: la cartera es
una foto que se reemplaza con cada carga del Excel de Causas, así que el archivo
de julio ya no está en la base en octubre y el período no se puede recalcular.

```bash
# crontab -e  en el host
0 4 1 * * docker exec ed_backend python -m app.jobs.generar_facturacion >> /var/log/estado_diario_facturacion.log 2>&1
```

Es idempotente: un cliente que ya tiene factura del período se salta, así que
dispararlo dos veces el día 1 no cobra dos veces. Además lo respalda un índice
único por cliente y período.

Si la base de un cliente estaba caída, **no se le emite factura** —una factura
en cero gastaría un número del correlativo en un documento que nadie debería
mandar— y el job devuelve código 1. Se arregla la base y se vuelve a correr: los
que ya tienen factura se saltan solos. Para rehacer una factura ya emitida, el
mismo día (la anula y emite otra con su propio número):

```bash
docker exec ed_backend python -m app.jobs.generar_facturacion --periodo 2026-07 --rehacer
```

Las facturas se consultan en **Administración de la plataforma → Facturación**,
con filtros por período, RUT, cliente activo/inactivo, nombre y número. La
estimación del mes en curso (antes de que existan las facturas) está en
**Facturación → Estimar el mes**, y las tarifas de cada cliente en su ficha →
**Tarifas**.

### Pago en línea con Webpay Plus (opcional)

El estudio puede pagar su factura con tarjeta desde **Mis Facturas**. El botón
aparece solo en las facturas emitidas y solo si la plataforma tiene el pago
encendido; el cobro lo procesa Transbank y los datos de la tarjeta no pasan por
el sitio.

**Viene apagado.** Se configura en **Administración → Configuración →
Transbank**: ambiente (integración o producción), código de comercio y API key.
La API key se guarda cifrada, igual que la contraseña de la casilla de correo, y
no vuelve a mostrarse. En integración, sin credenciales propias, se usa el
comercio de prueba de Transbank y no se cobra nada.

**Nada va en el `.env`** salvo `PUBLIC_BASE_URL`, que ya existe: de ahí sale la
URL a la que Transbank devuelve el navegador
(`PUBLIC_BASE_URL/api/v1/pagos/webpay/retorno`). Tiene que ser la URL **pública**
del sitio y en producción tiene que ser `https`.

Cómo funciona, y por qué importa el orden:

1. El estudio aprieta *Pagar* y el backend crea la transacción en Transbank.
2. El navegador va al formulario de Webpay. **Todavía no se cobró nada.**
3. Al volver, el backend *confirma* la transacción. Recién ahí se captura el
   cargo, se marca la factura como pagada y se redibuja el PDF con la cinta
   PAGADA.

Una transacción creada y no confirmada **se reversa sola a los 10 minutos**, así
que un usuario que cierra el navegador a mitad de camino no queda con un cargo.

Cada intento —aprobado, rechazado, anulado o abandonado— queda registrado y se
consulta en la ficha de la factura, en la consola. Ahí está la **orden de
compra**, que es el dato que pide Transbank para buscar una transacción, y el
código de autorización.

Dos cosas que conviene saber:

- **El monto se compara antes de dar nada por pagado.** Si lo confirmado por
  Transbank no coincide con el de la factura, el pago queda en `error`, la
  factura NO se marca y queda el aviso en el log.
- **Pagar toda la deuda levanta la suspensión por mora**, y solo esa: un cliente
  que el operador desactivó a mano no se reactiva pagando. Lo que las distingue
  es la columna `cliente.suspendido_por_mora`, que escribe el job de mora.

Para probar, con el ambiente en *integración*, están las tarjetas de prueba que
publica Transbank en su documentación de Webpay Plus. El botón *Probar conexión*
de la pantalla de configuración crea una transacción de $10 que no se confirma:
sirve para validar las credenciales sin cobrar, incluso en producción.

### Rediseño del documento

El PDF de una factura se escribe **una sola vez**, al emitirla, y no se regenera
al descargarlo: eso es lo que garantiza que la copia que el cliente tiene en su
correo y la que baja hoy sean el mismo archivo. Hay dos excepciones.

La primera es automática: el documento lleva una cinta con el estado —NO PAGADA,
PAGADA, ANULADA— y esa cinta es el único dato que cambia después de emitido, así
que marcar pagada o anular vuelve a dibujar el PDF guardado. No se recalcula
nada: número, líneas y total salen de la factura tal como quedó.

La segunda es a mano, cuando cambia el diseño y hay facturas viejas con el
anterior:

```bash
docker exec ed_backend python -m app.jobs.redibujar_facturas --simular
docker exec ed_backend python -m app.jobs.redibujar_facturas
```

Acepta `--desde AAAA-MM`, `--hasta AAAA-MM` y `--numero` (repetible). **No va al
crontab**: reescribe el PDF de documentos ya entregados, así que conviene correr
primero `--simular`, que no escribe nada.

### Migración desde la versión anterior

La versión anterior tenía dos tablas: `facturacion_cierre` (el cálculo mensual)
y `factura` + `factura_linea` (una orden de compra por rango de fechas). Un job
de un solo uso las convierte en facturas mensuales:

```bash
docker exec ed_backend python -m app.jobs.migrar_facturas_mensuales --simular
docker exec ed_backend python -m app.jobs.migrar_facturas_mensuales
```

Las facturas migradas quedan con una línea "Causas por materia" en vez del
desglose por materia: el cierre viejo guardaba un solo número para todas juntas
y el archivo de causas de ese mes ya no está. El desglose empieza con las que
genere el job mensual.

Las tablas viejas **no se borran solas**. Cuando el resultado esté revisado, se
agregan a `TABLAS_A_BORRAR_MAESTRA` en `backend/app/core/esquema.py`.

### El documento

El PDF se dibuja al generar la factura, sale con la edición y la copia
bloqueadas, y **se guarda en la base tal como se entregó** (`factura.pdf`). Al
descargarlo se devuelve esa copia, no una nueva: es la referencia contra la que
se contrasta cualquier archivo que llegue adulterado. Los permisos del formato
disuaden pero no impiden — si algún día se necesita que la alteración sea
detectable sin tener la copia al lado, lo que corresponde es una firma digital
con certificado.

La numeración es un correlativo global de la plataforma (`000001`, `000002`).
Anular **no borra ni libera el número**: un talonario con huecos no se puede
auditar. Rehacer un período anula la factura anterior y emite otra con su propio
número, en vez de cambiarle el monto a un documento que ya salió.

Los datos de la cabecera (razón social, RUT, giro, dirección, comuna y ciudad)
salen de la ficha del cliente, pestaña *Datos*, y se **copian** en la factura al
generarla: corregir la dirección después no reescribe las facturas ya emitidas.
Lo mismo con las tarifas: cada línea del detalle guarda el valor unitario que
usó, así que subir un precio rige desde la próxima generación y no antes.

**No es un DTE del SII**: no lleva folio autorizado ni timbre electrónico.

> **No es un documento tributario del SII.** No lleva folio autorizado (CAF) ni
> timbre electrónico, y el propio PDF lo dice al pie. Emitir el DTE es una
> integración aparte.

## Datos Iniciales (Seeds)

Al iniciar el backend, en la base **principal**:
- El administrador de la plataforma, solo si no hay ninguno (ver *Primer Ingreso*).

Al dar de alta un **cliente**, en su base recién creada:
- Las 18 tablas del esquema operativo.
- 9 jurisdicciones predefinidas (Civil, Familia, Laboral, Penal, etc.).

La base de un cliente **nace sin usuarios**: los crea el administrador desde la
ficha del cliente. Así la clave inicial la escribe alguien que la va a
comunicar, en vez de quedar una cuenta genérica que nadie recuerda desactivar.

## Desarrollo Local (sin Docker)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8091
```

### Frontend
```bash
cd frontend
npm install
npm start
# Acceder en http://localhost:4200
```

## Comandos Útiles

```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f backend

# Reiniciar un servicio
docker-compose restart backend

# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (solo uploads; la BD vive en el host y NO se borra)
docker-compose down -v

# Reconstruir un servicio
docker-compose up -d --build backend
```
