from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# NeonDB connection string
DATABASE_URL = "link db"

# Create engine with SSL requirements
engine = create_engine(
    DATABASE_URL,
    connect_args={
        "sslmode": "require",
        "channel_binding": "require"
    }
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()