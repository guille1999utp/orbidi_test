"""Create the application database if it does not exist.

Usage (from backend folder):

  .venv\\Scripts\\activate
  set DATABASE_URL=postgresql://postgres:pass@localhost:5432/ticketing
  python scripts/ensure_db.py

Or load .env manually. Connects to maintenance DB `postgres` with same credentials.
"""
import os
import sys

try:
    import psycopg2
    from psycopg2 import sql
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("Install deps: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    # Allow loading .env without extra dependency
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.isfile(env_path) and not os.environ.get("DATABASE_URL"):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    k, v = k.strip(), v.strip().strip('"').strip("'")
                    if k == "DATABASE_URL" and v:
                        os.environ["DATABASE_URL"] = v
                        break

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Defina DATABASE_URL o cree backend/.env con DATABASE_URL.", file=sys.stderr)
        sys.exit(1)

    tail = url.rstrip("/").split("/")[-1]
    db_name = tail.split("?")[0] if tail else "ticketing"
    admin_url = url.rsplit("/", 1)[0] + "/postgres"

    conn = psycopg2.connect(admin_url)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
    if cur.fetchone():
        print(f'OK: la base "{db_name}" ya existe.')
    else:
        cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name)))
        print(f'Creada la base "{db_name}". Reinicia uvicorn.')
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
