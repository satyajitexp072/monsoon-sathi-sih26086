"""
Minimal Postgres-backed key-value store.

Farmer profiles and WhatsApp registration state used to be local JSON
files (see git history of farmer_store.py / whatsapp_state.py), which
worked locally but silently lost all data on every Render redeploy —
Render's free-tier filesystem is ephemeral and resets on each deploy.
That's a real problem for a WhatsApp bot where losing registrations on
every deploy means farmers have to re-register constantly.

One shared (namespace, key) -> jsonb table rather than a table per
concern, since every current use case is "store one JSON blob per phone
number" — no need for a fuller relational schema yet. This is a
deliberate exception to this project's "no DB unless explicitly asked"
convention (see AGENTS.md), made because production data loss on every
deploy isn't acceptable for a farmer-facing feature.
"""

import json
import logging
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

logger = logging.getLogger("uvicorn.error")

DATABASE_URL = os.environ.get("DATABASE_URL")
_use_postgres = bool(DATABASE_URL)
_initialized = False
_local_store: dict[str, dict[str, dict]] = {}

_LOCAL_STORE_PATH = Path(__file__).resolve().parent.parent / "data" / "local_kv_store.json"

def _seed_demo_farmers():
    farmers = {
        "+919876543210": {
            "phone": "+919876543210",
            "name": "Ramesh Shinde",
            "district_name": "Pune",
            "lat": 18.5204,
            "lon": 73.8567,
            "state": "Maharashtra",
            "crops": ["Sugarcane", "Soybean"],
            "land_size_acres": 4.5,
            "irrigation_access": True,
            "language": "hi",
        },
        "+919822012345": {
            "phone": "+919822012345",
            "name": "Sunita Patil",
            "district_name": "Haveli, Pune",
            "lat": 18.4800,
            "lon": 73.9200,
            "state": "Maharashtra",
            "crops": ["Paddy", "Vegetables"],
            "land_size_acres": 2.0,
            "irrigation_access": False,
            "language": "en",
        },
        "+919422398765": {
            "phone": "+919422398765",
            "name": "Anand Kulkarni",
            "district_name": "Shirur, Pune",
            "lat": 18.8200,
            "lon": 74.3700,
            "state": "Maharashtra",
            "crops": ["Cotton", "Jowar"],
            "land_size_acres": 6.0,
            "irrigation_access": True,
            "language": "en",
        },
    }
    _local_store["farmers"] = farmers

def _load_local_store():
    global _local_store
    if _LOCAL_STORE_PATH.exists():
        try:
            with open(_LOCAL_STORE_PATH, "r", encoding="utf-8") as f:
                _local_store = json.load(f)
        except Exception:
            _local_store = {}
    if not _local_store.get("farmers"):
        _seed_demo_farmers()

def _save_local_store():
    try:
        _LOCAL_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(_LOCAL_STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(_local_store, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not persist local store: {e}")

_load_local_store()

@contextmanager
def _connect():
    global _use_postgres
    if not _use_postgres:
        yield None
        return

    import psycopg2
    try:
        conn = psycopg2.connect(DATABASE_URL)
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        logger.warning(f"PostgreSQL connection failed ({e}); falling back to local file store.")
        _use_postgres = False
        yield None


def _ensure_table() -> None:
    global _initialized, _use_postgres
    if _initialized or not _use_postgres:
        return
    try:
        with _connect() as conn:
            if conn is not None:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        CREATE TABLE IF NOT EXISTS kv_store (
                            namespace TEXT NOT NULL,
                            key TEXT NOT NULL,
                            value JSONB NOT NULL,
                            PRIMARY KEY (namespace, key)
                        )
                        """
                    )
                _initialized = True
    except Exception as e:
        logger.warning(f"Failed to initialize PostgreSQL table ({e}); falling back to local file store.")
        _use_postgres = False


def get(namespace: str, key: str) -> Optional[dict]:
    _ensure_table()
    if _use_postgres:
        try:
            with _connect() as conn:
                if conn is not None:
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT value FROM kv_store WHERE namespace = %s AND key = %s",
                            (namespace, key),
                        )
                        row = cur.fetchone()
                        return row[0] if row else None
        except Exception:
            pass

    return _local_store.get(namespace, {}).get(key)


def set(namespace: str, key: str, value: dict) -> None:
    _ensure_table()
    if _use_postgres:
        try:
            import psycopg2.extras
            with _connect() as conn:
                if conn is not None:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO kv_store (namespace, key, value)
                            VALUES (%s, %s, %s)
                            ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value
                            """,
                            (namespace, key, psycopg2.extras.Json(value)),
                        )
                    return
        except Exception:
            pass

    if namespace not in _local_store:
        _local_store[namespace] = {}
    _local_store[namespace][key] = value
    _save_local_store()


def delete(namespace: str, key: str) -> None:
    _ensure_table()
    if _use_postgres:
        try:
            with _connect() as conn:
                if conn is not None:
                    with conn.cursor() as cur:
                        cur.execute(
                            "DELETE FROM kv_store WHERE namespace = %s AND key = %s",
                            (namespace, key),
                        )
                    return
        except Exception:
            pass

    if namespace in _local_store and key in _local_store[namespace]:
        del _local_store[namespace][key]
        _save_local_store()


def list_all(namespace: str) -> list[dict]:
    _ensure_table()
    if _use_postgres:
        try:
            with _connect() as conn:
                if conn is not None:
                    with conn.cursor() as cur:
                        cur.execute("SELECT value FROM kv_store WHERE namespace = %s", (namespace,))
                        return [row[0] for row in cur.fetchall()]
        except Exception:
            pass

    return list(_local_store.get(namespace, {}).values())
