from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from app.database import get_session
from app.models import User, Office, PPMP, PPMPItem
from app.auth import get_current_user, check_role

router = APIRouter(prefix="/api/offices", tags=["offices"])



@router.get("/ppmps", response_model=List[PPMP])
def list_ppmps(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["end_user", "bac_admin"])),
):
    """List all PPMPs belonging to the user's office."""
    if not current_user.office_id:
        raise HTTPException(status_code=400, detail="User is not assigned to any office")
    return session.exec(
        select(PPMP).where(PPMP.office_id == current_user.office_id)
    ).all()


@router.post("/ppmps", response_model=PPMP)
def create_ppmp(
    ppmp_data: PPMP,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["end_user"])),
):
    """Create a new PPMP for the current office."""
    if not current_user.office_id:
        raise HTTPException(status_code=400, detail="User is not assigned to any office")
    
    new_ppmp = PPMP(
        title=ppmp_data.title,
        fiscal_year=ppmp_data.fiscal_year,
        office_id=current_user.office_id,
        status="Draft",
        type=ppmp_data.type,
    )
    session.add(new_ppmp)
    session.commit()
    session.refresh(new_ppmp)
    return new_ppmp


@router.get("/ppmps/{ppmp_id}")
def get_ppmp(
    ppmp_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get details of a specific PPMP and its items."""
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
    
    # Restrict end-users to only view their office's PPMPs
    if current_user.role == "end_user" and ppmp.office_id != current_user.office_id:
        raise HTTPException(status_code=403, detail="Access denied to this office's PPMP")
        
    return {
        "ppmp": ppmp,
        "items": ppmp.items
    }


@router.post("/ppmps/{ppmp_id}/submit")
def submit_ppmp(
    ppmp_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["end_user"])),
):
    """Submit PPMP for budget review."""
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
        
    if ppmp.office_id != current_user.office_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if ppmp.status in ["Pending Budget Review", "Approved"]:
        raise HTTPException(status_code=400, detail=f"PPMP is already {ppmp.status} and locked")

    ppmp.status = "Pending Budget Review"
    session.add(ppmp)
    session.commit()
    session.refresh(ppmp)
    return {"message": "PPMP submitted for budget review successfully", "status": ppmp.status}


@router.post("/ppmps/{ppmp_id}/items", response_model=PPMPItem)
def add_ppmp_item(
    ppmp_id: int,
    item_data: PPMPItem,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["end_user"])),
):
    """Add a new item to a PPMP (only if PPMP is not approved or pending review)."""
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
        
    if ppmp.office_id != current_user.office_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if ppmp.status in ["Pending Budget Review", "Approved"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="PPMP is locked for revisions because it is approved or pending review"
        )

    estimated = item_data.quantity * item_data.unit_cost
    new_item = PPMPItem(
        ppmp_id=ppmp_id,
        description=item_data.description,
        category=item_data.category,
        is_cse=item_data.is_cse,
        quantity=item_data.quantity,
        unit_of_measure=item_data.unit_of_measure,
        unit_cost=item_data.unit_cost,
        estimated_budget=estimated,
        procurement_mode=item_data.procurement_mode,
        q1_qty=item_data.q1_qty,
        q2_qty=item_data.q2_qty,
        q3_qty=item_data.q3_qty,
        q4_qty=item_data.q4_qty,
    )
    session.add(new_item)
    session.commit()
    session.refresh(new_item)
    return new_item


@router.delete("/ppmps/{ppmp_id}/items/{item_id}")
def delete_ppmp_item(
    ppmp_id: int,
    item_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["end_user"])),
):
    """Delete an item from a PPMP."""
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
        
    if ppmp.office_id != current_user.office_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if ppmp.status in ["Pending Budget Review", "Approved"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="PPMP is locked for revisions"
        )

    item = session.get(PPMPItem, item_id)
    if not item or item.ppmp_id != ppmp_id:
        raise HTTPException(status_code=404, detail="Item not found in this PPMP")
        
    session.delete(item)
    session.commit()
    return {"message": "Item deleted successfully"}
