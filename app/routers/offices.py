import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import List, Optional
from app.database import get_session
from app.models import User, Office, PPMP, PPMPItem
from app.auth import get_current_user, check_role
from app.ppmp_template import export_ppmp_xlsx, write_signatory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/offices", tags=["offices"])


# --- ITEM CATALOG (PostgreSQL cse_catalog_item, JSON fallback) ---
_ITEM_CATALOG_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "item_catalog.json"
)


def _load_item_catalog_from_json() -> dict:
    try:
        with _ITEM_CATALOG_PATH.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        logger.warning("Item catalog missing at %s", _ITEM_CATALOG_PATH)
        return {"version": 0, "items": [], "count": 0, "source": "json-missing"}
    items = data.get("items", [])
    return {
        "version": data.get("version", 1),
        "updated_at": data.get("updated_at"),
        "source": data.get("source") or "json",
        "items": items,
        "count": len(items),
    }


@router.get("/item-catalog")
def get_item_catalog(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return the CSE item catalog used by the description combobox.
    Prefer PostgreSQL ``cse_catalog_item``; fall back to JSON if empty."""
    from app.models import CseCatalogItem

    rows = session.exec(
        select(CseCatalogItem).order_by(CseCatalogItem.category, CseCatalogItem.description)
    ).all()
    if rows:
        items = [
            {
                "code": r.code or "",
                "description": r.description,
                "unit_of_measure": r.unit_of_measure or "piece",
                "category": r.category,
                "is_cse": True if r.is_cse is None else bool(r.is_cse),
            }
            for r in rows
        ]
        return {
            "version": 2,
            "source": "database",
            "updated_at": (
                max((r.updated_at for r in rows if r.updated_at), default=None)
            ),
            "items": items,
            "count": len(items),
        }

    return _load_item_catalog_from_json()


# --- SIGNATORY ENDPOINTS ---
class SignatoryPayload(BaseModel):
    submitted_by: Optional[str] = None
    submitted_by_designation: Optional[str] = None
    prepared_by: Optional[str] = None
    prepared_by_designation: Optional[str] = None
    aip_reference: Optional[str] = None
    responsibility_center_no: Optional[str] = None
    office_code_from_pr: Optional[str] = None
    office_id: Optional[int] = None


def _serialize_signatory(office: Office) -> dict:
    return {
        "office_id": office.id,
        "office_name": office.name,
        "office_code": office.code,
        "submitted_by": office.submitted_by or "",
        "submitted_by_designation": office.submitted_by_designation or "",
        "prepared_by": office.prepared_by or "",
        "prepared_by_designation": office.prepared_by_designation or "",
        "aip_reference": office.aip_reference or "",
        "responsibility_center_no": office.responsibility_center_no or "",
        "office_code_from_pr": office.office_code_from_pr or "",
        "ppmp_template_path": office.ppmp_template_path or "",
    }


def _resolve_office(
    session: Session, current_user: User, office_id: Optional[int]
) -> Office:
    target_id = office_id if office_id is not None else current_user.office_id
    if not target_id:
        raise HTTPException(
            status_code=400, detail="User is not assigned to any office"
        )
    if current_user.role == "end_user" and target_id != current_user.office_id:
        raise HTTPException(
            status_code=403, detail="Access denied to this office's signatory"
        )
    office = session.get(Office, target_id)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    return office


@router.get("/signatory")
def get_signatory(
    office_id: Optional[int] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return the current signatory values for the caller's office (or the
    given office_id when the caller has elevated privileges)."""
    office = _resolve_office(session, current_user, office_id)
    return _serialize_signatory(office)


@router.post("/signatory")
def update_signatory(
    payload: SignatoryPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["end_user", "bac_admin"])),
):
    """Persist signatory fields on the Office row and rewrite the office's
    NGPA_PPMP.xlsx footer with the new values."""
    office = _resolve_office(session, current_user, payload.office_id)

    office.submitted_by = payload.submitted_by
    office.submitted_by_designation = payload.submitted_by_designation
    office.prepared_by = payload.prepared_by
    office.prepared_by_designation = payload.prepared_by_designation
    office.aip_reference = payload.aip_reference
    office.responsibility_center_no = payload.responsibility_center_no
    office.office_code_from_pr = payload.office_code_from_pr

    try:
        template_path = write_signatory(office)
        try:
            from app.ppmp_template import REPO_ROOT
            office.ppmp_template_path = str(
                template_path.relative_to(REPO_ROOT)
            ).replace("\\", "/")
        except ValueError:
            office.ppmp_template_path = str(template_path)
    except FileNotFoundError as exc:
        logger.error("Master template missing: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Master PPMP template is missing on the server.",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to write signatory into office template")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update PPMP template: {exc}",
        )

    session.add(office)
    session.commit()
    session.refresh(office)

    return {
        "message": "Signatory information updated successfully",
        "signatory": _serialize_signatory(office),
    }


# --- BUDGET ALLOCATION ENDPOINTS FOR END USERS ---
class BudgetUpdate(BaseModel):
    budget_allocation: float

@router.get("/budget/{office_id}")
def get_office_budget(
    office_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get the budget allocation for a specific office (for end users to view their allocation)."""
    # End users can only view their own office's budget
    if current_user.role == "end_user" and current_user.office_id != office_id:
        raise HTTPException(status_code=403, detail="Access denied to this office's budget")
    
    office = session.get(Office, office_id)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    
    return {"budget_allocation": office.budget_allocation}


@router.put("/budget/{office_id}")
def update_office_budget(
    office_id: int,
    budget_data: BudgetUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["end_user", "bac_admin"])),
):
    """Update the budget allocation for an office.
    
    - End users can update their own office's budget allocation
    - BAC admins can update any office's budget allocation
    """
    # End users can only update their own office's budget
    if current_user.role == "end_user" and current_user.office_id != office_id:
        raise HTTPException(status_code=403, detail="Access denied to update this office's budget")
    
    office = session.get(Office, office_id)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    
    office.budget_allocation = budget_data.budget_allocation
    session.add(office)
    session.commit()
    session.refresh(office)
    
    return {"message": "Budget allocation updated successfully", "budget_allocation": office.budget_allocation}



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
    """Get details of a specific PPMP and its items, enriched with office/
    signatory info so the NGPA-format view can render prepared-by / submitted-by
    without an extra round-trip."""
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    # Restrict end-users to only view their office's PPMPs
    if current_user.role == "end_user" and ppmp.office_id != current_user.office_id:
        raise HTTPException(status_code=403, detail="Access denied to this office's PPMP")

    office = session.get(Office, ppmp.office_id) if ppmp.office_id else None
    office_payload = None
    if office is not None:
        office_payload = {
            "id": office.id,
            "name": office.name,
            "code": office.code,
            "prepared_by": office.prepared_by or "",
            "prepared_by_designation": office.prepared_by_designation or "",
            "submitted_by": office.submitted_by or "",
            "submitted_by_designation": office.submitted_by_designation or "",
        }

    return {
        "ppmp": ppmp,
        "items": ppmp.items,
        "office": office_payload,
    }


@router.get("/ppmps/{ppmp_id}/export")
def export_ppmp(
    ppmp_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Download the office's NGPA_PPMP.xlsx filled with this PPMP's items."""
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    if current_user.role == "end_user" and ppmp.office_id != current_user.office_id:
        raise HTTPException(status_code=403, detail="Access denied to this office's PPMP")

    office = session.get(Office, ppmp.office_id) if ppmp.office_id else None
    if office is None:
        raise HTTPException(status_code=404, detail="Office for this PPMP not found")

    try:
        content = export_ppmp_xlsx(office, ppmp, ppmp.items)
    except FileNotFoundError as exc:
        logger.error("Master template missing: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Master PPMP template is missing on the server.",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to export PPMP xlsx")
        raise HTTPException(status_code=500, detail=f"PPMP export failed: {exc}")

    safe_title = "".join(
        ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in (ppmp.title or "PPMP")
    ).strip("_") or "PPMP"
    filename = f"NGPA_PPMP_{safe_title}_FY{ppmp.fiscal_year}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


@router.delete("/ppmps/{ppmp_id}")
def delete_ppmp(
    ppmp_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["end_user"])),
):
    """Delete a PPMP (and its line items) — only while it is still in Draft
    status and belongs to the caller's office. Submitted, returned, and
    approved PPMPs cannot be deleted from this endpoint."""
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    if ppmp.office_id != current_user.office_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if ppmp.status != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"PPMP cannot be deleted while status is '{ppmp.status}'. Only Draft PPMPs may be deleted.",
        )

    # Remove line items first to avoid foreign-key violations.
    items = session.exec(select(PPMPItem).where(PPMPItem.ppmp_id == ppmp_id)).all()
    for item in items:
        session.delete(item)

    session.delete(ppmp)
    session.commit()
    return {"message": "PPMP deleted successfully", "ppmp_id": ppmp_id}


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
