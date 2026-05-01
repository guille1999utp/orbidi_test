# Sistema de ticketing (FastAPI + Next.js + PostgreSQL)

Aplicación full stack para crear y seguir incidencias: SSO Google, tablero en lista y Kanban con arrastre, comentarios, adjuntos (límite 10 MB), reasignación, notificaciones in-app, actualización casi en tiempo real vía WebSocket y **asistente de IA** integrado que opera sobre los mismos tickets usando el API con tu sesión.

## Pila técnica

| Capa | Tecnologías |
|------|-------------|
| **Backend** | Python 3.11, FastAPI, SQLAlchemy 2, PostgreSQL, JWT tras verificación del ID token de Google (`google-auth`), adjuntos en disco local u **opcionalmente Amazon S3**, WebSocket para difundir cambios de tickets y notificaciones. |
| **Frontend** | Next.js 15 (App Router), React 18, Tailwind CSS, `@react-oauth/google`, `@dnd-kit` (Kanban), **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/react`) para chat en streaming con herramientas (*function calling*). |
| **IA (producto)** | API de **Anthropic**; modelo por defecto configurable (p. ej. `claude-sonnet-4-5`). El asistente no entrena con tus datos: envía el mensaje y ejecuta herramientas que llaman al backend. |
| **Local / demo** | Docker Compose: Postgres, API y frontend con healthcheck en la base de datos para evitar condiciones de carrera al arrancar. |

## Asistente de IA (integración en la app)

Tras iniciar sesión aparece un panel de chat que habla con un modelo de Anthropic y puede **crear, listar, leer, comentar, asignar, desasignar, actualizar y borrar** tickets en tu nombre, usando el mismo JWT que el resto de la app.

### Cómo funciona

1. El cliente envía mensajes a **`POST /api/chat`** (Route Handler de Next.js) con cabecera `Authorization: Bearer <token>`.
2. El servidor valida el token, usa **Anthropic** vía `@ai-sdk/anthropic` y `streamText` con un límite de pasos (`stopWhen: stepCountIs(12)`).
3. Las herramientas están definidas en `frontend/lib/ticketing-tools.ts` y ejecutan peticiones HTTP al FastAPI (`assistant-server-fetch.ts`), prefijando rutas con `/api` como en el backend.

### Herramientas expuestas al modelo

| Herramienta | Uso breve |
|-------------|-----------|
| `createTicket` | Alta de ticket (título, descripción, prioridad, estado opcional, asignado por UUID o por subcadena única en nombre/correo con `assigneeNameOrEmail`). |
| `listTickets` | Lista con búsqueda opcional por texto. |
| `getTicket` | Detalle por UUID. |
| `listUsers` | Usuarios para asignar o resolver IDs. |
| `addComment` | Comentario en un ticket. |
| `assignTicket` / `unassignTicket` | Asignar responsable o dejar sin asignar. |
| `updateTicket` | Cambiar estado y/o prioridad. |
| `deleteTicket` | Borrado permanente (solo si el usuario lo pide con claridad). |

El **prompt de sistema** (español) está en `frontend/app/api/chat/route.ts` e instruye al modelo a usar `createTicket`, no inventar UUIDs y ser explícito con acciones destructivas.

### Modelos y variables del asistente

| Variable | Descripción |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Obligatoria para `/api/chat`. Clave de la consola de Anthropic. |
| `ANTHROPIC_MODEL` | Opcional. Por defecto en código: `claude-sonnet-4-5`. Puedes fijar otros identificadores que exponga Anthropic (p. ej. variantes Sonnet, Haiku, Opus según disponibilidad en tu cuenta). |

El proveedor y el identificador exacto del modelo dependen de la API de Anthropic en el momento del despliegue; revisa su documentación si cambias `ANTHROPIC_MODEL`.

### Servidor Next vs navegador: `API_URL`

Las herramientas del asistente se ejecutan **en el servidor Next**. Ahí `NEXT_PUBLIC_API_URL=http://localhost:8000` no sirve dentro de Docker (localhost sería el propio contenedor). Por eso existe **`API_URL`**, con prioridad en `assistant-server-fetch.ts`: en Compose se define `API_URL=http://backend:8000` mientras el navegador sigue usando `NEXT_PUBLIC_API_URL=http://localhost:8000`.

## Requisitos previos

- Cuenta de Google Cloud con **OAuth 2.0 Client ID** (tipo *Web application*).
- Orígenes JavaScript autorizados: `http://localhost:3000` (y el de producción si aplica).
- **El mismo Client ID** en frontend (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`) y backend (`GOOGLE_CLIENT_ID`).
- Para el asistente: cuenta en **Anthropic** y `ANTHROPIC_API_KEY` en el entorno del frontend (servidor).

## Variables de entorno

### Backend (`backend/.env` o Compose)

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Cadena SQLAlchemy/Postgres. En Docker Compose se sobrescribe a la base del servicio `db`. |
| `GOOGLE_CLIENT_ID` | Client ID de Google (login). |
| `JWT_SECRET` | Secreto para firmar JWT (valor largo y aleatorio en producción). |
| `FRONTEND_URL` | Origen CORS, p. ej. `http://localhost:3000`. |
| `UPLOADS_DIR` | Directorio de adjuntos cuando no usas S3. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME` | Opcionales; si están definidos, los adjuntos nuevos pueden usar S3 (ver código de almacenamiento). |

### Frontend (`frontend/.env.local`)

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | URL pública del API para el **navegador**, p. ej. `http://localhost:8000`. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Mismo valor que `GOOGLE_CLIENT_ID` en el backend. |
| `API_URL` | Opcional en local; en **Docker** la fija Compose a `http://backend:8000` para el servidor Next (asistente y llamadas server-side al API). |
| `ANTHROPIC_API_KEY` | Clave para `/api/chat`. |
| `ANTHROPIC_MODEL` | Opcional; por defecto `claude-sonnet-4-5` en `route.ts`. |

Copia `frontend/.env.example` y `backend/.env.example` como plantilla.

## Cómo ejecutar sin Docker

1. **PostgreSQL:** la base de `DATABASE_URL` debe existir. **Primera vez:** con `.env` en `backend`, `python scripts/ensure_db.py` o `CREATE DATABASE ticketing;` manual.

2. **Backend:**
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   pip install -r requirements.txt
   # Configura DATABASE_URL, GOOGLE_CLIENT_ID, JWT_SECRET, etc.
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Frontend:**
   ```bash
   cd frontend
   copy .env.example .env.local   # Windows; edita valores
   npm install
   npm run dev
   ```

Abre `http://localhost:3000`, inicia sesión con Google y usa el tablero. El asistente requiere `ANTHROPIC_API_KEY` en `.env.local` y reinicio del servidor de desarrollo tras cambiarla.

## Docker Compose

En la raíz del repo:

```bash
set GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
set JWT_SECRET=una-cadena-larga-secreta
docker compose up --build
```

- **API:** `http://localhost:8000` (OpenAPI: `/docs`).
- **Frontend:** `http://localhost:3000`.
- **Base de datos:** healthcheck con `pg_isready` y `depends_on: condition: service_healthy` para que la API no arranque antes de que Postgres acepte conexiones.

### Variables y archivos en Compose

- **Backend:** `env_file` opcional hacia `backend/.env`; `DATABASE_URL` y `UPLOADS_DIR` en `environment` alinean Docker (host `db`, volumen de subidas).
- **Frontend:** `env_file` opcional hacia `frontend/.env.local` para secretos (p. ej. `ANTHROPIC_API_KEY`). En runtime se inyectan `API_URL=http://backend:8000` y las `NEXT_PUBLIC_*` necesarias para el cliente.

### Build del frontend y `NEXT_PUBLIC_*`

Las variables `NEXT_PUBLIC_*` se resuelven en **`npm run build`**. Compose suele pasar `--build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=` vacío; BuildKit puede dejar esa variable en el entorno como cadena vacía y **Next.js** entonces prioriza `process.env` frente a `.env.local`. El `Dockerfile` del frontend **elimina del entorno** esas claves vacías antes del build para que `.env.local` del contexto se aplique. Si cambias secretos públicos de OAuth, reconstruye: `docker compose build --no-cache frontend`.

## Tests automatizados

Los tests son **unitarios**: no sustituyen pruebas end-to-end con navegador ni una base PostgreSQL real para todas las rutas. El backend evita tocar DDL real en el *lifespan* durante los tests (ver `tests/conftest.py`).

### Backend (pytest)

Desde la carpeta **`backend/`** (Python 3.11 recomendado, misma versión que el Dockerfile):

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python -m pytest tests -v
```

- **Resumen:** esquemas Pydantic (`TicketCreate`, `CommentCreate`, etc.), JWT (`create_access_token` / `decode_token`), helpers de S3 sin llamar a AWS, y **`GET /api/health`** con `TestClient` y *lifespan* acotado.
- **Configuración:** `pytest.ini` (`testpaths = tests`, `pythonpath = .`).

### Frontend (Vitest)

Desde **`frontend/`**:

```bash
cd frontend
npm install
npm test              # una pasada
npm run test:watch    # modo interactivo
```

- **Resumen:** `parseApiErrorMessage`, `apiUrl`, `wsUrl` (`lib/api.test.ts`) y prioridad `API_URL` vs `NEXT_PUBLIC_API_URL` en el asistente (`lib/assistant-server-fetch.test.ts`).
- **Configuración:** `vitest.config.ts` (alias `@` igual que Next).

### Notas

- No hace falta tener Postgres levantado para estos tests del backend.
- Si añades integración contra la API real o la base, conviene marcarlos aparte (p. ej. `pytest -m integration`) y documentar `DATABASE_URL` / `docker compose up db`.

## Alcance y límites

**Incluido**

- Estados: Abierto, En progreso, En revisión, Cerrado; prioridades; filtros y orden en lista; Kanban con cambio de estado al soltar.
- Comentarios, adjuntos con listado y límite de tamaño, descarga autenticada; almacenamiento local o S3 si está configurado.
- Reasignación entre usuarios registrados; notificaciones por asignación, comentario y cambio de estado; contador de no leídas; WebSocket para refresco en vivo.
- **Asistente de IA** con streaming, herramientas sobre tickets y sesión del usuario autenticado.
- **Tests unitarios** (pytest en backend, Vitest en frontend).

**Fuera de alcance / mejoras posibles**

- Notificaciones push fuera del navegador; suite E2E (Playwright/Cypress); soft-delete de tickets; permisos avanzados por rol.

Además del **asistente dentro de la aplicación** (Anthropic + Vercel AI SDK), el repositorio se apoyó en **Cursor** y modelos de asistencia (p. ej. familias GPT) para: diseño inicial del esquema y rutas, scaffold FastAPI/Next.js, Kanban y WebSocket, ajustes de tipos, integración del chat y herramientas (`ticketing-tools`, `API_URL` en Docker, healthchecks, documentación) y redacción de este README. Las decisiones de arquitectura (JWT + ID token de Google, Postgres, archivos/S3, broadcast por WebSocket) son propias del proyecto y están pensadas para una demo clara en local y en Compose.
