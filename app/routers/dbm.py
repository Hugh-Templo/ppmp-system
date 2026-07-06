from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from app.database import get_session
from app.models import User, DBMClassification
from app.auth import check_role

router = APIRouter(prefix="/api/dbm", tags=["dbm"])


@router.get("/classifications", response_model=List[DBMClassification])
def list_dbm_classifications(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin", "budget_office", "end_user"])),
):
    """List all DBM classifications."""
    return session.exec(select(DBMClassification)).all()


@router.post("/classifications", response_model=DBMClassification)
def create_dbm_classification(
    classification_data: DBMClassification,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Add a new DBM classification."""
    # Check if code already exists
    existing = session.exec(select(DBMClassification).where(DBMClassification.code == classification_data.code)).first()
    if existing:
        raise HTTPException(status_code=400, detail="DBM classification code already exists")
    
    new_classification = DBMClassification(
        code=classification_data.code,
        project_title=classification_data.project_title,
        classification=classification_data.classification,
    )
    session.add(new_classification)
    session.commit()
    session.refresh(new_classification)
    return new_classification


@router.get("/classifications/{classification_id}")
def get_dbm_classification(
    classification_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin", "budget_office", "end_user"])),
):
    """Get a specific DBM classification."""
    classification = session.get(DBMClassification, classification_id)
    if not classification:
        raise HTTPException(status_code=404, detail="DBM classification not found")
    return classification


@router.delete("/classifications/{classification_id}")
def delete_dbm_classification(
    classification_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Delete a DBM classification."""
    classification = session.get(DBMClassification, classification_id)
    if not classification:
        raise HTTPException(status_code=404, detail="DBM classification not found")
    
    session.delete(classification)
    session.commit()
    return {"message": "DBM classification deleted successfully"}
