from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from app.database import get_session
from app.models import User, PPMP, Office
from app.auth import check_role

router = APIRouter(prefix="/api/budget", tags=["budget"])


@router.get("/pending", response_model=List[PPMP])
def list_pending_ppmps(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office", "bac_admin"])),
):
    """List all PPMPs that are pending budget review."""
    return session.exec(
        select(PPMP).where(PPMP.status == "Pending Budget Review")
    ).all()


@router.get("/ppmps/{ppmp_id}/audit")
def audit_ppmp(
    ppmp_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office", "bac_admin"])),
):
    """Get audit comparison for an office's budget vs PPMP estimated cost."""
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
        
    office = session.get(Office, ppmp.office_id)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    total_ppmp_cost = sum(item.estimated_budget for item in ppmp.items)
    
    return {
        "ppmp_id": ppmp.id,
        "ppmp_title": ppmp.title,
        "office_name": office.name,
        "office_budget_allocation": office.budget_allocation,
        "total_ppmp_cost": total_ppmp_cost,
        "is_within_budget": total_ppmp_cost <= office.budget_allocation,
        "remaining_budget": office.budget_allocation - total_ppmp_cost
    }


@router.post("/ppmps/{ppmp_id}/review")
def review_ppmp(
    ppmp_id: int,
    action: str,  # "approve" or "return"
    remarks: str = "",
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office"])),
):
    """Approve or return a PPMP."""
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    if action == "approve":
        ppmp.status = "Approved"
    elif action == "return":
        ppmp.status = "Returned"
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'return'")

    session.add(ppmp)
    session.commit()
    session.refresh(ppmp)
    return {
        "message": f"PPMP has been successfully {ppmp.status}",
        "status": ppmp.status,
        "remarks": remarks
    }
