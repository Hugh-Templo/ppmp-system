import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from app.database import init_db, get_session
from app.models import Office
from app.scheduler import start_scheduler
from app.routers.auth import router as auth_router
from app.routers.offices import router as offices_router
from app.routers.budget import router as budget_router
from app.routers.bac import router as bac_router
from app.routers.dbm import router as dbm_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Initialize scheduler if needed
    try:
        start_scheduler()
    except Exception as e:
        logging.warning(f"Failed to start scheduler: {e}")
    yield


app = FastAPI(title="Ormoc City PPMP-APP Consolidation System", lifespan=lifespan)

# Add CORS Middleware so React frontend can talk to it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "running"}


@app.get("/api/offices")
def list_offices_public(session: Session = Depends(get_session)):
    """Public endpoint for registration form to list offices."""
    return session.exec(select(Office)).all()


# Register Routers
app.include_router(auth_router)
app.include_router(offices_router)
app.include_router(budget_router)
app.include_router(bac_router)
app.include_router(dbm_router)
