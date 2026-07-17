from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from app.database import get_session
from app.models import User, APP, APPRow, Office, PPMP, PPMPItem, IndicativePPMP, FinalPPMP
from app.auth import check_role, get_current_user

router = APIRouter(prefix="/api/bac", tags=["bac"])


class OfficeUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    budget_allocation: Optional[float] = None


@router.get("/offices", response_model=List[Office])
def list_offices_bac(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
    include_inactive: bool = False,
):
    """List offices (active by default). Soft-deleted offices are hidden unless
    ``include_inactive=true``."""
    stmt = select(Office).order_by(Office.code)
    if not include_inactive:
        stmt = stmt.where(Office.is_active == True)  # noqa: E712
    return session.exec(stmt).all()


@router.post("/offices", response_model=Office)
def create_office(
    office_data: Office,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Add a new office, or reactivate a soft-deleted office with the same code
    so historical PPMPs and the local template folder remain linked."""
    code = (office_data.code or "").strip()
    name = (office_data.name or "").strip()
    if not code or not name:
        raise HTTPException(status_code=400, detail="Office name and code are required")

    existing = session.exec(select(Office).where(Office.code == code)).first()
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=400, detail="Office code already exists")

        # Reactivate soft-deleted office — keep same id so PPMPs stay attached.
        name_clash = session.exec(
            select(Office).where(
                Office.name == name,
                Office.id != existing.id,
            )
        ).first()
        if name_clash and name_clash.is_active:
            raise HTTPException(status_code=400, detail="Office name already exists")

        existing.name = name
        existing.budget_allocation = office_data.budget_allocation or 0.0
        existing.is_active = True
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    name_clash = session.exec(select(Office).where(Office.name == name)).first()
    if name_clash:
        if name_clash.is_active:
            raise HTTPException(status_code=400, detail="Office name already exists")
        # Inactive row holds this name under a different code — free the name.
        name_clash.name = f"{name} (archived-{name_clash.id})"
        session.add(name_clash)
        session.flush()

    new_office = Office(
        name=name,
        code=code,
        budget_allocation=office_data.budget_allocation or 0.0,
        is_active=True,
    )
    session.add(new_office)
    session.commit()
    session.refresh(new_office)
    return new_office


@router.put("/offices/{office_id}", response_model=Office)
def update_office(
    office_id: int,
    payload: OfficeUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Update an existing office (name, code, budget ceiling)."""
    office = session.get(Office, office_id)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    if not office.is_active:
        raise HTTPException(
            status_code=400,
            detail="Office is inactive. Recreate it with the same code to restore.",
        )

    if payload.code is not None and payload.code != office.code:
        clash = session.exec(select(Office).where(Office.code == payload.code)).first()
        if clash:
            raise HTTPException(status_code=400, detail="Office code already exists")
        office.code = payload.code

    if payload.name is not None and payload.name != office.name:
        clash = session.exec(select(Office).where(Office.name == payload.name)).first()
        if clash and clash.is_active:
            raise HTTPException(status_code=400, detail="Office name already exists")
        office.name = payload.name

    if payload.budget_allocation is not None:
        office.budget_allocation = float(payload.budget_allocation)

    session.add(office)
    session.commit()
    session.refresh(office)
    return office


@router.delete("/offices/{office_id}")
def delete_office(
    office_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Soft-delete an office. PPMPs, items, and the local template folder under
    templates/end-users/{office_code}/ are retained. Assigned users are
    unassigned so accounts can be recreated later against the same office."""
    office = session.get(Office, office_id)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    if not office.is_active:
        raise HTTPException(status_code=400, detail="Office is already inactive")

    try:
        assigned_users = session.exec(
            select(User).where(User.office_id == office_id)
        ).all()
        for user_row in assigned_users:
            user_row.office_id = None
            session.add(user_row)

        office.is_active = False
        session.add(office)
        session.commit()
    except Exception as exc:  # noqa: BLE001
        session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete office: {exc}",
        ) from exc

    return {
        "message": (
            "Office removed from active list. Created PPMPs and local template "
            "files were kept. Recreate this office with the same code to restore access."
        ),
        "office_id": office_id,
        "office_code": office.code,
        "users_unassigned": len(assigned_users),
        "ppmps_retained": True,
    }


@router.post("/consolidate/{fiscal_year}", response_model=APP)
def consolidate_ppmps(
    fiscal_year: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """
    Consolidate all budget-approved office PPMPs for the specified fiscal year
    into a single APP (CSE and non-CSE rows kept separate via item.is_cse).
    If an APP already exists for that year, it is recalculated.
    """
    # 1. Fetch all Approved office PPMPs for this year
    approved_ppmps = session.exec(
        select(PPMP).where(
            PPMP.fiscal_year == fiscal_year,
            PPMP.status == "Approved",
        )
    ).all()

    app = session.exec(select(APP).where(APP.fiscal_year == fiscal_year)).first()

    # No approved sources: clear any leftover APP rows so CSE/nonCSE NGPA forms
    # do not keep showing a prior consolidation after PPMPs were removed/changed.
    if not approved_ppmps:
        if app:
            existing_rows = session.exec(
                select(APPRow).where(APPRow.app_id == app.id)
            ).all()
            for row in existing_rows:
                session.delete(row)
            session.commit()
            session.refresh(app)
            return app
        raise HTTPException(
            status_code=400,
            detail=f"No approved PPMPs found for fiscal year {fiscal_year} to consolidate",
        )

    # 2. Find or create the APP entity
    if app:
        existing_rows = session.exec(select(APPRow).where(APPRow.app_id == app.id)).all()
        for row in existing_rows:
            session.delete(row)
        session.commit()
    else:
        app = APP(
            title=f"Consolidated Annual Procurement Plan (APP) FY {fiscal_year}",
            fiscal_year=fiscal_year,
        )
        session.add(app)
        session.commit()
        session.refresh(app)

    # 3. Consolidate items grouped by NGPA dimensions (per RA 12009 APP layout).
    #    Group key: (is_cse, description, project_type, procurement_mode, fund_source)
    ppmp_ids = [p.id for p in approved_ppmps]
    office_lookup = {o.id: o for o in session.exec(select(Office)).all()}
    ppmp_office_lookup = {p.id: office_lookup.get(p.office_id) for p in approved_ppmps}
    ppmp_kind_lookup = {p.id: bool(p.is_cse) for p in approved_ppmps}

    all_items = session.exec(
        select(PPMPItem).where(PPMPItem.ppmp_id.in_(ppmp_ids))
    ).all()

    # If a typed PPMP has items but none match its CSE/nonCSE kind (flag drift),
    # treat those items as the PPMP kind so CSE/nonCSE APP stay aligned with sources.
    items_by_ppmp: dict = {}
    for item in all_items:
        items_by_ppmp.setdefault(item.ppmp_id, []).append(item)

    effective_is_cse: dict = {}
    for ppmp_id, ppmp_items in items_by_ppmp.items():
        want = bool(ppmp_kind_lookup.get(ppmp_id, False))
        if ppmp_items and not any(bool(it.is_cse) == want for it in ppmp_items):
            for it in ppmp_items:
                effective_is_cse[it.id] = want
        else:
            for it in ppmp_items:
                effective_is_cse[it.id] = bool(it.is_cse)

    consolidation_map: dict = {}
    for item in all_items:
        item_is_cse = effective_is_cse.get(item.id, bool(item.is_cse))
        key = (
            item_is_cse,
            (item.description or "").strip().lower(),
            item.project_type or "",
            item.procurement_mode or "",
            item.fund_source or "",
        )
        if key not in consolidation_map:
            consolidation_map[key] = {
                "description": item.description,
                "is_cse": item_is_cse,
                "project_type": item.project_type,
                "procurement_mode": item.procurement_mode or "Competitive Bidding",
                "fund_source": item.fund_source,
                "quantity_size": item.quantity_size,
                "proc_start": item.proc_start,
                "proc_end": item.proc_end,
                "delivery_period": item.delivery_period,
                "pre_proc_conf": bool(item.pre_proc_conf),
                "total_estimated_budget": 0.0,
                "offices": set(),
                "total_quantity": 0,
                "q1_qty": 0,
                "q2_qty": 0,
                "q3_qty": 0,
                "q4_qty": 0,
                "category": item.category,
                "unit_of_measure": item.unit_of_measure,
                "unit_cost": item.unit_cost,
            }

        group = consolidation_map[key]
        group["total_estimated_budget"] += item.estimated_budget or 0.0
        group["total_quantity"] += item.quantity or 0
        group["q1_qty"] += item.q1_qty or 0
        group["q2_qty"] += item.q2_qty or 0
        group["q3_qty"] += item.q3_qty or 0
        group["q4_qty"] += item.q4_qty or 0

        office = ppmp_office_lookup.get(item.ppmp_id)
        if office is not None:
            group["offices"].add(office.code or office.name or "")

    # 4. Save consolidated rows
    for group in consolidation_map.values():
        row = APPRow(
            app_id=app.id,
            description=group["description"],
            is_cse=group["is_cse"],
            project_type=group["project_type"],
            procurement_mode=group["procurement_mode"],
            fund_source=group["fund_source"],
            quantity_size=group["quantity_size"],
            proc_start=group["proc_start"],
            proc_end=group["proc_end"],
            delivery_period=group["delivery_period"],
            pre_proc_conf=group["pre_proc_conf"],
            total_estimated_budget=group["total_estimated_budget"],
            end_user_offices=", ".join(sorted(o for o in group["offices"] if o)) or None,
            category=group["category"],
            total_quantity=group["total_quantity"],
            unit_of_measure=group["unit_of_measure"],
            unit_cost=group["unit_cost"],
            q1_qty=group["q1_qty"],
            q2_qty=group["q2_qty"],
            q3_qty=group["q3_qty"],
            q4_qty=group["q4_qty"],
        )
        session.add(row)

    session.commit()
    session.refresh(app)
    return app


@router.get("/ppmps/approved")
def list_approved_ppmps_for_app(
    fiscal_year: int,
    kind: str = "cse",
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """List budget-approved office PPMPs for a FY that belong to CSE or non-CSE.

    A PPMP is included when it has matching line items (item.is_cse), or when the
    PPMP itself was created as that kind (ppmp.is_cse) even if item flags drifted.
    """
    kind_norm = (kind or "cse").strip().lower()
    if kind_norm not in ("cse", "noncse"):
        raise HTTPException(status_code=400, detail="kind must be 'cse' or 'noncse'")
    want_cse = kind_norm == "cse"

    approved = session.exec(
        select(PPMP).where(
            PPMP.fiscal_year == fiscal_year,
            PPMP.status == "Approved",
        )
    ).all()
    if not approved:
        return []

    office_lookup = {o.id: o for o in session.exec(select(Office)).all()}
    result = []
    for ppmp in approved:
        items = session.exec(
            select(PPMPItem).where(PPMPItem.ppmp_id == ppmp.id)
        ).all()
        matching = [it for it in items if bool(it.is_cse) == want_cse]
        # Fallback: PPMP typed as this kind but items missing/incorrect is_cse flags
        if not matching and bool(ppmp.is_cse) == want_cse and items:
            matching = list(items)
        if not matching:
            continue
        office = office_lookup.get(ppmp.office_id)
        result.append(
            {
                "id": ppmp.id,
                "title": ppmp.title,
                "fiscal_year": ppmp.fiscal_year,
                "status": ppmp.status,
                "office_id": ppmp.office_id,
                "office_name": office.name if office else "",
                "office_code": office.code if office else "",
                "item_count": len(matching),
                "total_estimated_budget": sum(
                    float(it.estimated_budget or 0) for it in matching
                ),
                "is_cse_kind": want_cse,
            }
        )

    result.sort(key=lambda r: ((r["office_name"] or "").lower(), (r["title"] or "").lower()))
    return result


@router.post("/indicative/ppmps/{ppmp_id}/approve")
def approve_indicative_ppmp(
    ppmp_id: int,
    remarks: str = "",
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Approve an indicative PPMP for consolidation."""
    ppmp = session.get(IndicativePPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="Indicative PPMP not found")
    
    # Validate that PPMP is in Posted status
    if ppmp.posting_status != "Posted":
        raise HTTPException(status_code=400, detail="Only Posted PPMPs can be approved")
    
    # Update posting status
    ppmp.posting_status = "Approved"
    ppmp.approved_at = datetime.utcnow()
    ppmp.approved_by = current_user.id
    
    session.add(ppmp)
    session.commit()
    session.refresh(ppmp)
    
    return {
        "message": "Indicative PPMP approved successfully",
        "status": ppmp.posting_status,
        "approved_at": ppmp.approved_at,
        "remarks": remarks
    }


@router.post("/indicative/ppmps/{ppmp_id}/reject")
def reject_indicative_ppmp(
    ppmp_id: int,
    remarks: str = "",
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Reject an indicative PPMP (return to budget office for revision)."""
    ppmp = session.get(IndicativePPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="Indicative PPMP not found")
    
    # Validate that PPMP is in Posted status
    if ppmp.posting_status != "Posted":
        raise HTTPException(status_code=400, detail="Only Posted PPMPs can be rejected")
    
    # Update posting status
    ppmp.posting_status = "Rejected"
    ppmp.rejected_at = datetime.utcnow()
    ppmp.rejected_by = current_user.id
    ppmp.rejection_remarks = remarks
    
    session.add(ppmp)
    session.commit()
    session.refresh(ppmp)
    
    return {
        "message": "Indicative PPMP rejected successfully",
        "status": ppmp.posting_status,
        "rejected_at": ppmp.rejected_at,
        "remarks": remarks
    }


@router.get("/apps", response_model=List[APP])
def list_apps(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin", "budget_office", "end_user"])),
):
    """List all consolidated APPs."""
    return session.exec(select(APP)).all()


@router.get("/apps/by-year/{fiscal_year}")
def get_app_by_year(
    fiscal_year: int,
    kind: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Return the consolidated APP for a fiscal year, optionally filtered by CSE/nonCSE."""
    app = session.exec(select(APP).where(APP.fiscal_year == fiscal_year)).first()
    if not app:
        return {"app": None, "rows": []}

    rows = list(app.rows or [])
    if kind:
        kind_norm = kind.strip().lower()
        if kind_norm not in ("cse", "noncse"):
            raise HTTPException(status_code=400, detail="kind must be 'cse' or 'noncse'")
        want_cse = kind_norm == "cse"
        rows = [r for r in rows if bool(r.is_cse) == want_cse]

    return {"app": app, "rows": rows}


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


@router.post("/sync-sheets")
def trigger_sheets_sync(
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Manually trigger Google Sheets → PostgreSQL sync (Option B)."""
    try:
        from app.sheets_sync import sync_from_sheets
        count, message = sync_from_sheets()
        return {"success": True, "offices_synced": count, "message": message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sheets sync failed: {str(e)}")


@router.post("/cse-catalog/sync")
def sync_cse_catalog(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Reload all CSE items from templates/APP-CSE 2027 Form .xlsx into the DB."""
    try:
        from app.cse_catalog import sync_cse_catalog_to_db

        summary = sync_cse_catalog_to_db(session, also_write_json=True)
        return {
            "success": True,
            "message": f"Synced {summary['count']} CSE items into the database",
            **summary,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"CSE catalog sync failed: {e}")


@router.get("/cse-catalog")
def list_cse_catalog(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """List CSE catalog rows currently stored in PostgreSQL."""
    from app.models import CseCatalogItem

    rows = session.exec(
        select(CseCatalogItem).order_by(
            CseCatalogItem.category, CseCatalogItem.description
        )
    ).all()
    return {
        "count": len(rows),
        "source": "database",
        "items": [
            {
                "id": r.id,
                "code": r.code,
                "description": r.description,
                "unit_of_measure": r.unit_of_measure,
                "category": r.category,
                "is_cse": r.is_cse,
            }
            for r in rows
        ],
    }


XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _xlsx_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/apps/{fiscal_year}/export/cse")
def export_cse_app_endpoint(
    fiscal_year: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Download the consolidated CSE APP as NGPA_CSE-APP.xlsx."""
    try:
        from app.app_export import export_cse_app
        content = export_cse_app(session, fiscal_year)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSE APP export failed: {str(e)}")
    return _xlsx_response(content, f"APP-CSE-FY{fiscal_year}.xlsx")


@router.get("/apps/{fiscal_year}/export/noncse")
def export_noncse_app_endpoint(
    fiscal_year: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Download the consolidated non-CSE APP as NGPA_nonCSE-APP.xlsx."""
    try:
        from app.app_export import export_noncse_app
        content = export_noncse_app(session, fiscal_year)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Non-CSE APP export failed: {str(e)}")
    return _xlsx_response(content, f"APP-nonCSE-FY{fiscal_year}.xlsx")


@router.get("/apps/{fiscal_year}/export/combined")
def export_combined_app_endpoint(
    fiscal_year: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Download the combined CSE + non-CSE APP xlsx."""
    try:
        from app.app_export import export_combined_app
        content = export_combined_app(session, fiscal_year)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Combined APP export failed: {str(e)}")
    return _xlsx_response(content, f"APP-Combined-FY{fiscal_year}.xlsx")
