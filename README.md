# Sistema de ticketing (FastAPI + Next.js + PostgreSQL)

Aplicación full stack para crear y seguir incidencias: SSO Google, tablero en lista y Kanban con arrastre, comentarios, adjuntos (10 MB), reasignación, notificaciones in-app y actualización en tiempo casi real vía WebSocket.

## Pila técnica

- **Backend:** FastAPI, SQLAlchemy 2, PostgreSQL, JWT tras verificación del ID token de Google (`google-auth`), ficheros en disco, WebSocket para difundir cambios de tickets y avisos de notificaciones.
- **Frontend:** Next.js 15 (App Router), React 18, Tailwind, `@react-oauth/google` para el botón de login, `@dnd-kit` para Kanban.
- **Despliegue local:** Docker Compose (Postgres + API + frontend).

## Requisitos previos

- Cuenta de Google Cloud con **OAuth 2.0 Client ID** (tipo *Web application*).
- Orígenes JavaScript autorizados: `http://localhost:3000` (y el que uses en producción).
- **El mismo Client ID** en frontend (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`) y backend (`GOOGLE_CLIENT_ID`) para validar el token.

## Variables de entorno

### Backend (`backend/.env` o variables en Compose)

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Por defecto Postgres local: `postgresql://ticket:ticket@localhost:5432/ticketing` |
| `GOOGLE_CLIENT_ID` | Client ID de Google (obligatorio para login) |
| `JWT_SECRET` | Secreto firma JWT (valor largo aleatorio en producción) |
| `FRONTEND_URL` | Origen CORS, p. ej. `http://localhost:3000` |
| `UPLOADS_DIR` | Directorio de adjuntos (por defecto `uploads`) |

### Frontend (`frontend/.env.local`)

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | URL del API, p. ej. `http://localhost:8000` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Mismo Client ID que en el backend |

## Cómo ejecutar sin Docker

1. **PostgreSQL:** Postgres debe estar en marcha y la base indicada en `DATABASE_URL` debe existir. **Primera vez:** desde `backend`, con `.env` configurado, ejecuta `python scripts/ensure_db.py` (conecta a la base `postgres` del mismo servidor y crea la base, p. ej. `ticketing`). También puedes hacer `CREATE DATABASE ticketing;` a mano.

2. **Backend:**
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   pip install -r requirements.txt
   set DATABASE_URL=postgresql://...
   set GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   set JWT_SECRET=una-cadena-larga-secreta
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Frontend:**
   ```bash
   cd frontend
   copy .env.example .env.local   # y edita valores
   npm install
   npm run dev
   ```

Abre `http://localhost:3000`, inicia sesión con Google y usa `/board`.

## Docker Compose

En la raíz del repo:

```bash
set GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
set JWT_SECRET=una-cadena-larga-secreta
docker compose up --build
```

- API: `http://localhost:8000` (documentación OpenAPI: `/docs`).
- Frontend: `http://localhost:3000`.

El navegador debe poder llamar al API en `NEXT_PUBLIC_API_URL` (por defecto `http://localhost:8000`).

## Alcance y límites

- **Incluido:** estados Abierto / En progreso / En revisión / Cerrado; prioridades; filtros y ordenación en lista; Kanban con cambio de estado al soltar; comentarios cronológicos; adjuntos con listado, descarga autenticada y borrado; reasignación a cualquier usuario registrado; notificaciones por asignación, comentario (autor/asignado) y cambio de estado (quien no realizó el cambio); contador de no leídas; sincronización en vivo por WebSocket.
- **Fuera de alcance / mejoras posibles:** notificaciones push fuera del navegador, tests automáticos exhaustivos, almacenamiento de objetos en S3, soft-delete de tickets, permisos por rol.

## Uso de IA en este proyecto

Se utilizó **Cursor (agente con GPT)** para: definición inicial del esquema de datos y rutas, scaffold de FastAPI/Next.js, componentes de Kanban y WebSocket, revisión de tipos compatibles con Python 3.9/3.11, y redacción estructurada del README. Las decisiones (JWT + verificación de ID token, Postgres, ficheros locales, difusión broadcast por WebSocket) están pensadas para una prueba técnica clara y desplegable en local.
