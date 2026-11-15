# Puesta en marcha (sin Docker)

Todo se hace contra un proyecto de Supabase en la nube. En tu computadora solo necesitas Node.js (ya lo tienes).

## 1. Crear el proyecto en Supabase

1. Entra a <https://supabase.com> → **New project**.
2. Nombre: `navidad-en-familia`. Región: **South America (São Paulo)**, la más cercana a Perú.
3. Guarda la **contraseña de la base de datos** en un lugar seguro (la pedirá la CLI). No la compartas en el chat.

## 2. Configurar la autenticación

En **Authentication**:

- **Sign In / Providers → Email**: activado. Deja **Confirm email** activado (solo afecta al organizador, que se registra con su correo).
- **URL Configuration**:
  - *Site URL*: `http://localhost:5173` por ahora (después, la URL de Render).
  - *Redirect URLs*: agrega `http://localhost:5173/**` (y luego `https://TU-APP.onrender.com/**`).

> El correo incluido en Supabase envía muy pocos mensajes por hora. Alcanza para que se registren organizadores; los
> familiares no reciben correos.

## 3. Variables del frontend

Copia `.env.example` como `.env.local` y completa los datos de **Project Settings → API**:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_MEMBER_EMAIL_DOMAIN=usuarios.navidad.invalid
```

Estos dos valores son públicos por diseño. **Nunca** pongas la clave `service_role` en este archivo.

## 4. Crear las tablas (migraciones)

En una terminal dentro de la carpeta del proyecto (la primera vez abre el navegador para iniciar sesión):

```powershell
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF   # el "ref" es la parte xxxx de la URL; pide la contraseña de la BD
npx supabase db push                              # aplica supabase/migrations/*.sql
```

**Alternativa sin CLI:** en Supabase → **SQL Editor**, pega y ejecuta, **en este orden**, el contenido de:
`20261114000001_core_schema.sql`, `20261114000002_security.sql`, `20261114000003_wishlist_rpc.sql`,
`20261114000004_event_join_code.sql`, `20261114000005_code_history_white_color.sql`, `20261114000006_checklist.sql`, `20261114000007_responsibilities.sql`, `20261114000008_games.sql`, `20261114000009_secret_friend.sql`, `20261114000010_schedule_announcements.sql`,
`20261115000011_family_access.sql`, `20261115000012_service_role_app_schema.sql`, `20261115000013_wishlist_brands_price_range.sql`,
`20261115000014_wishlist_photos_drive.sql`, `20261115000015_delete_account.sql`, `20261115000016_event_drive.sql`.

> Si ya habías aplicado las primeras migraciones, `npx supabase db push` aplica solo las nuevas.

Verificación rápida en el SQL Editor:

```sql
select app.normalize_name('  josé   pérez ');   -- debe devolver: JOSÉ PÉREZ
```

## 5. Publicar las Edge Functions (crear usuarios y contraseñas)

```powershell
npx supabase functions deploy create-member --use-api
npx supabase functions deploy reset-member-password --use-api
npx supabase functions deploy change-join-code --use-api
npx supabase functions deploy family-access --use-api --no-verify-jwt   # pública: enlace de la familia
npx supabase functions deploy link-preview --use-api                     # «Pega el enlace» al agregar un regalo
npx supabase secrets set MEMBER_EMAIL_DOMAIN=usuarios.navidad.invalid
```

> **Pegar el enlace de la tienda.** `link-preview` lee la página del producto (nombre, precio y foto que la tienda publica para
> compartir enlaces) y no guarda nada. Es gratis: no usa ninguna API de pago y entra en el plan gratuito de Edge Functions de
> Supabase. Solo la pueden usar personas con sesión, y solo lee direcciones públicas. Algunas tiendas no dejan leer sus
> páginas; en ese caso la app guarda el enlace y pide llenar los datos a mano.

> **Enlace de la familia.** `family-access` es la única función pública (`--no-verify-jwt`): la usan los familiares antes de
> tener sesión. Valida el enlace y la palabra secreta, y solo deja entrar a cuentas con rol *participante*. No requiere
> cambiar nada en Authentication: usa el proveedor **Email**, que ya está activado, y no envía ningún correo.

`--use-api` empaqueta las funciones en los servidores de Supabase, así que **no necesita Docker**.

Cuando tengas la URL de Render, limita quién puede llamar a las funciones:

```powershell
npx supabase secrets set APP_ORIGINS=https://TU-APP.onrender.com,http://localhost:5173
```

## 5b. Fotos de los regalos con Google Drive (opcional)

Las fotos de los regalos se guardan en Google Drive. El organizador o un administrador conecta **una sola cuenta para todas
las familias** y, si alguna familia quiere, **una cuenta propia** que reemplaza a la general solo para ella
(**Organizar → Fotos de los regalos**). Para eso la app necesita un "cliente OAuth" de Google. Se configura una sola vez:

1. Entra a <https://console.cloud.google.com> → crea un proyecto (ej. `duende-ayudante`).
2. **APIs y servicios → Biblioteca** → busca **Google Drive API** → **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento de OAuth** (Google Auth Platform):
   - Tipo de usuario: **Externo**. Nombre de la app, tu correo de soporte y de contacto.
   - **Acceso a los datos → Agregar permisos**: `openid`, `.../auth/userinfo.email` y `.../auth/drive.file`.
     `drive.file` solo deja ver los archivos que crea la app, y Google **no** lo considera un permiso sensible:
     no hace falta verificación.
   - **Público**: mientras esté "En prueba", agrega como *usuarios de prueba* los correos de Google que se van a
     conectar (máximo 100). Para no depender de esa lista, toca **Publicar app**.
4. **Clientes → Crear cliente** → tipo **Aplicación web**.
   - *URI de redireccionamiento autorizados*: `https://TU-PROYECTO.supabase.co/functions/v1/google-drive`
   - Copia el **ID de cliente** y el **secreto**. El secreto **no** va en el frontend ni en el chat.
5. Publica la función y guarda los secretos:

```powershell
npx supabase functions deploy google-drive --use-api --no-verify-jwt   # Google vuelve aquí sin sesión; los POST verifican la sesión adentro
npx supabase secrets set GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
npx supabase secrets set GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
npx supabase secrets set GOOGLE_OAUTH_STATE_SECRET=<texto-al-azar-de-al-menos-32-caracteres>
npx supabase secrets set APP_URL=https://TU-APP.onrender.com   # a dónde volver si el navegador no envía su origen
```

Para generar el texto al azar en PowerShell:
`-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})`

> **Privacidad.** El token de Google se guarda solo en la base (`family_drives`), y ningún usuario de la app puede leerlo,
> ni siquiera el organizador. Las fotos quedan como "cualquiera con el enlace puede ver" para que la app las muestre;
> los enlaces no se pueden adivinar y solo los ven quienes están en la celebración. Si se desconecta un Drive, las fotos
> ya subidas siguen en esa cuenta.

## 6. Probar en tu computadora

```powershell
npm run dev            # abre http://localhost:5173
npm run dev -- --host  # para probar desde tu celular conectado al mismo Wi-Fi
```

Recorrido de prueba:

1. **Crear mi Navidad** → registra tu correo → confirma el correo → **Entrar**.
2. Crea la celebración → te lleva a **Organizar**.
3. Crea una familia → agrega a un familiar con usuario → **Enviar por WhatsApp**.
4. En otro navegador o en el celular, abre el enlace del mensaje (ya trae el código y el usuario), escribe la
   contraseña y agrega regalos con enlaces.

## 7. Publicar en Render

1. Sube el proyecto a un repositorio de GitHub.
2. En Render: **New → Blueprint** y elige el repositorio (usa `render.yaml`), o **New → Static Site**:
   - Build command: `npm ci && npm run build`
   - Publish directory: `dist`
   - Rewrite: `/*` → `/index.html`
3. Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MEMBER_EMAIL_DOMAIN`.
4. Con la URL final: agrégala en Supabase (Site URL y Redirect URLs) y en el secreto `APP_ORIGINS`.

## Pruebas automáticas

```powershell
npm test         # 148 pruebas: reglas de la app + base de datos real (PGlite) con políticas RLS por rol
npm run build    # verificación de tipos + build de producción
```

Las pruebas de base de datos ejecutan las migraciones reales en **PGlite** (PostgreSQL en WebAssembly), sin Docker.
