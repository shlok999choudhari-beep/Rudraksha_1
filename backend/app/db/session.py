"""
Database Session and Engine Configuration for VeriGuard AI.
Supports PostgreSQL natively via DATABASE_URL, with local SQLite fallback (sqlite:///./veriguard.db).
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

# Read connection string from environment or use local SQLite database file
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./veriguard.db")

# SQLite connection args vs PostgreSQL pool args
connect_args = {}
engine_kwargs = {"pool_pre_ping": True}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine_kwargs["connect_args"] = connect_args
else:
    # PostgreSQL / Supabase pool options
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI Dependency for database session lifecycle."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
