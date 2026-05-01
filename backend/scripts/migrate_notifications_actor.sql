-- Añade actor de la notificación (quien disparó el evento) para mostrar avatar en el front.
-- En bases existentes; el arranque del backend también ejecuta este parche en Postgres.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id) ON DELETE SET NULL;
