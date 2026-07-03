from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from app.database import get_session
from app.models import User, APP, APPRow, Office, PPMP, PPMPItem
from app.auth import check_role, get_current_user

router = APIRouter(prefix="/api/bac", tags=["bac"])


@router.post("/offices", response_model=Office)
def create_office(
    office_data: Office,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Add a new Office (for Ormoc City Hall's departments)."""
    existing = session.exec(select(Office).where(Office.code == office_data.code)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Office code already exists")
        
    new_office = Office(
        name=office_data.name,
        code=office_data.code,
        budget_allocation=office_data.budget_allocation
    )
    session.add(new_office)
    session.commit()
    session.refresh(new_office)
    return new_office


@router.post("/consolidate/{fiscal_year}", response_model=APP)
def consolidate_ppmps(
    fiscal_year: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """
    Consolidate all 'Approved' PPMPs for the specified fiscal year into a single APP.
    If an APP already exists for that year, it updates it.
    """
    # 1. Fetch all approved PPMPs for this year
    approved_ppmps = session.exec(
        select(PPMP).where(PPMP.fiscal_year == fiscal_year, PPMP.status == "Approved")
    ).all()
    
    if not approved_ppmps:
        raise HTTPException(
            status_code=400, 
            detail=f"No approved PPMPs found for fiscal year {fiscal_year} to consolidate"
        )
        
    # 2. Find or create the APP entity
    app = session.exec(select(APP).where(APP.fiscal_year == fiscal_year)).first()
    if app:
        # Delete existing rows for recalculation
        existing_rows = session.exec(select(APPRow).where(APPRow.app_id == app.id)).all()
        for row in existing_rows:
            session.delete(row)
        session.commit()
    else:
        app = APP(title=f"Consolidated Annual Procurement Plan (APP) FY {fiscal_year}", fiscal_year=fiscal_year)
        session.add(app)
        session.commit()
        session.refresh(app)

    # 3. Consolidate items grouped by description, category, is_cse, unit_cost, procurement_mode
    ppmp_ids = [p.id for p in approved_ppmps]
    all_items = session.exec(
        select(PPMPItem).where(PPMPItem.ppmp_id.in_(ppmp_ids))
    ).all()

    consolidation_map = {}
    for item in all_items:
        key = (item.description.strip().lower(), item.category, item.is_cse, item.unit_cost, item.procurement_mode, item.unit_of_measure)
        if key not in consolidation_map:
            consolidation_map[key] = {
                "description": item.description,
                "category": item.category,
                "is_cse": item.is_cse,
                "total_quantity": 0,
                "unit_of_measure": item.unit_of_measure,
                "unit_cost": item.unit_cost,
                "total_estimated_budget": 0.0,
                "procurement_mode": item.procurement_mode,
                "q1_qty": 0,
                "q2_qty": 0,
                "q3_qty": 0,
                "q4_qty": 0,
            }
            
        group = consolidation_map[key]
        group["total_quantity"] += item.quantity
        group["total_estimated_budget"] += item.estimated_budget
        group["q1_qty"] += item.q1_qty
        group["q2_qty"] += item.q2_qty
        group["q3_qty"] += item.q3_qty
        group["q4_qty"] += item.q4_qty

    # 4. Save consolidated rows
    for group in consolidation_map.values():
        row = APPRow(
            app_id=app.id,
            description=group["description"],
            category=group["category"],
            is_cse=group["is_cse"],
            total_quantity=group["total_quantity"],
            unit_of_measure=group["unit_of_measure"],
            unit_cost=group["unit_cost"],
            total_estimated_budget=group["total_estimated_budget"],
            procurement_mode=group["procurement_mode"],
            q1_qty=group["q1_qty"],
            q2_qty=group["q2_qty"],
            q3_qty=group["q3_qty"],
            q4_qty=group["q4_qty"],
        )
        session.add(row)
        
    session.commit()
    session.refresh(app)
    return app


@router.get("/apps", response_model=List[APP])
def list_apps(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin", "budget_office", "end_user"])),
):
    """List all consolidated APPs."""
    return session.exec(select(APP)).all()


@router.get("/apps/{app_id}")
def get_app(
    app_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get details of a consolidated APP and its items."""
    app = session.get(APP, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="APP not found")
        
    return {
        "app": app,
        "rows": app.rows
    }
