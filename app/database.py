import os
from sqlmodel import SQLModel, create_engine, Session
from app.config import DATABASE_URL

# For SQLite, make sure the parent folder exists
if DATABASE_URL.startswith("sqlite"):
    os.makedirs("./data", exist_ok=True)

engine = create_engine(DATABASE_URL, echo=False)


def init_db():
    SQLModel.metadata.create_all(engine)
    from sqlalchemy import text
    from sqlmodel import select
    from app.models import Office
    from app.cse_catalog import ensure_cse_catalog_seeded

    # Ensure soft-delete column exists on older databases (create_all won't ALTER).
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE office "
                "ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"
            )
        )

    with Session(engine) as session:
        if session.exec(select(Office)).first() is None:
            sample_offices = [
                Office(name="Bids and Awards Committee Office", code="O-BAC", budget_allocation=10000000.0),
                Office(name="City Budget Office", code="O-BUDGET", budget_allocation=5000000.0),
                Office(name="City Health Office", code="O-CHO", budget_allocation=20000000.0),
                Office(name="General Services Office", code="O-GSO", budget_allocation=15000000.0),
                Office(name="City Mayor's Office", code="O-CMO", budget_allocation=30000000.0),
            ]
            for o in sample_offices:
                session.add(o)
            session.commit()

        ensure_cse_catalog_seeded(session)


def get_session():
    with Session(engine) as session:
        yield session
