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
        conn.execute(
            text(
                "ALTER TABLE \"user\" "
                "ADD COLUMN IF NOT EXISTS plain_password VARCHAR"
            )
        )
        # Budget validate → post to BAC (office PPMP path)
        had_posting = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'ppmp' AND column_name = 'posting_status'"
            )
        ).first()
        conn.execute(
            text(
                "ALTER TABLE ppmp "
                "ADD COLUMN IF NOT EXISTS posting_status VARCHAR NOT NULL DEFAULT 'Draft'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE ppmp "
                "ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITHOUT TIME ZONE"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE ppmp "
                "ADD COLUMN IF NOT EXISTS posted_by INTEGER"
            )
        )
        # Older installs created legacy PPMP item fields as NOT NULL. The
        # current NGPA parser legitimately leaves these fields empty, so keep
        # the database schema aligned with the nullable SQLModel fields.
        conn.execute(
            text("ALTER TABLE ppmpitem ALTER COLUMN quantity DROP NOT NULL")
        )
        conn.execute(
            text("ALTER TABLE ppmpitem ALTER COLUMN unit_cost DROP NOT NULL")
        )
        # One-time: existing Approved rows were already in the BAC pool.
        # Do not re-run after the column exists (Approved + Draft means "validated, not posted").
        if not had_posting:
            conn.execute(
                text(
                    "UPDATE ppmp SET posting_status = 'Posted' "
                    "WHERE status = 'Approved'"
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
