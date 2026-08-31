"""
Database Session and Engine Configuration for VeriGuard AI.
Supports PostgreSQL natively via DATABASE_URL, with local SQLite fallback (sqlite:///./veriguard.db).
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Read connection string from environment or use local SQLite database file
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./veriguard.db")

# SQLite connection args for multi-threaded FastAPI handlers
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI Dependency for database session lifecycle."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
