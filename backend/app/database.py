"""
SQLAlchemy database engine and session factory.
Includes a lightweight migration helper that safely adds new columns
to existing SQLite databases without requiring Alembic.
"""
import logging
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import get_settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


def create_db_engine():
    settings = get_settings()
    url = settings.database_url
    if url.startswith("sqlite"):
        engine = create_engine(
            url,
            connect_args={"check_same_thread": False},
            echo=False,
        )
        # Enable WAL mode for better concurrent reads
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_conn, _):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    else:
        engine = create_engine(url, pool_pre_ping=True)
    return engine


engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _add_column_if_missing(conn, table: str, column: str, col_def: str) -> None:
    """Execute ALTER TABLE … ADD COLUMN … only if the column does not exist yet."""
    try:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        existing = {row[1] for row in rows}   # row[1] is column name
        if column not in existing:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}"))
            logger.info("DB migration: added column %s.%s", table, column)
    except Exception as exc:
        logger.warning("DB migration skipped %s.%s: %s", table, column, exc)


def _migrate(conn) -> None:
    """
    Non-destructive, additive migrations.
    Safe to run on every startup — skips columns that already exist.
    """
    # audits table — checkpoint / progress columns added in v2
    _add_column_if_missing(conn, "audits", "questions_processed", "INTEGER DEFAULT 0")
    _add_column_if_missing(conn, "audits", "last_checkpoint",     "TEXT")
    _add_column_if_missing(conn, "audits", "scan_status_detail",  "TEXT")

    # question_responses table — significant_gaps added in v3
    _add_column_if_missing(conn, "question_responses", "ai_significant_gaps", "TEXT")
    conn.commit()


def init_db():
    """Create all tables and apply additive schema migrations. Called at app startup."""
    from .models import audit, audit_log, response  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # Apply any column additions needed for existing databases
    with engine.begin() as conn:
        _migrate(conn)
