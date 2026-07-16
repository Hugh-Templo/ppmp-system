from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from app.database import get_session
from app.models import User, PPMP, Office, IndicativePPMP, FinalPPMP
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


@router.get("/indicative/pending", response_model=List[IndicativePPMP])
def list_pending_indicative_ppmps(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """List all indicative PPMPs pending BAC admin approval."""
    return session.exec(
        select(IndicativePPMP).where(IndicativePPMP.posting_status == "Posted")
    ).all()


@router.get("/indicative", response_model=List[IndicativePPMP])
def list_indicative_ppmps(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office"])),
):
    """List all indicative PPMPs for budget office posting management."""
    return session.exec(select(IndicativePPMP)).all()


@router.get("/final")
def list_final_ppmps(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office"])),
):
    """
    List Final PPMPs that end users have Submitted or Approved.
    Read-only view for Budget Office monitoring (RA 12009 Phase 4).
    Includes office_name and a supplemental flag for v2+ revisions.
    """
    rows = session.exec(
        select(FinalPPMP, Office)
        .join(Office, Office.id == FinalPPMP.office_id)
        .where(FinalPPMP.approval_status.in_(["Submitted", "Approved"]))
        .order_by(FinalPPMP.office_id, FinalPPMP.fiscal_year.desc(), FinalPPMP.version.desc())
    ).all()

    return [
        {
            "id": ppmp.id,
            "title": ppmp.title,
            "fiscal_year": ppmp.fiscal_year,
            "office_id": ppmp.office_id,
            "office_name": office.name,
            "version": ppmp.version,
            "is_supplemental": ppmp.version >= 2,
            "approval_status": ppmp.approval_status,
            "submitted_at": ppmp.submitted_at,
            "approved_at": ppmp.approved_at,
            "remarks": ppmp.remarks,
        }
        for ppmp, office in rows
    ]


@router.post("/indicative/ppmps/{ppmp_id}/post")
def post_indicative_ppmp(
    ppmp_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office"])),
):
    """Post an indicative PPMP for BAC admin review."""
    ppmp = session.get(IndicativePPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="Indicative PPMP not found")
    
    # Validate that PPMP is in Draft status
    if ppmp.status != "Draft":
        raise HTTPException(status_code=400, detail="Only Draft PPMPs can be posted")
    
    # Update posting status
    ppmp.posting_status = "Posted"
    ppmp.posted_at = datetime.utcnow()
    ppmp.posted_by = current_user.id
    
    session.add(ppmp)
    session.commit()
    session.refresh(ppmp)
    
    return {
        "message": "Indicative PPMP posted successfully",
        "status": ppmp.posting_status,
        "posted_at": ppmp.posted_at
    }


@router.post("/indicative/ppmps/{ppmp_id}/unpost")
def unpost_indicative_ppmp(
    ppmp_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office"])),
):
    """Unpost an indicative PPMP (remove from BAC admin review queue)."""
    ppmp = session.get(IndicativePPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="Indicative PPMP not found")
    
    # Only allow unposting if it's in Posted status
    if ppmp.posting_status != "Posted":
        raise HTTPException(status_code=400, detail="Only Posted PPMPs can be unposted")
    
    # Reset posting status
    ppmp.posting_status = "Draft"
    ppmp.posted_at = None
    ppmp.posted_by = None
    
    session.add(ppmp)
    session.commit()
    session.refresh(ppmp)
    
    return {
        "message": "Indicative PPMP unposted successfully",
        "status": ppmp.posting_status
    }


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
        ppmp.remarks = remarks  # Store remarks when returning for revision
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
