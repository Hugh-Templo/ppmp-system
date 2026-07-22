"""Shared APP consolidation helpers (DB and file-based sources)."""

from __future__ import annotations

from sqlmodel import Session, select

from app.models import APP, APPRow


def ensure_app_cleared(session: Session, fiscal_year: int) -> APP:
    app = session.exec(select(APP).where(APP.fiscal_year == fiscal_year)).first()
    if app:
        existing_rows = session.exec(select(APPRow).where(APPRow.app_id == app.id)).all()
        for row in existing_rows:
            session.delete(row)
        session.commit()
        session.refresh(app)
        return app
    app = APP(
        title=f"Consolidated Annual Procurement Plan (APP) FY {fiscal_year}",
        fiscal_year=fiscal_year,
    )
    session.add(app)
    session.commit()
    session.refresh(app)
    return app


def write_app_rows_from_item_dicts(session: Session, app: APP, item_dicts: list) -> None:
    """Group item dicts into APPRow records."""
    consolidation_map: dict = {}
    for item in item_dicts:
        item_is_cse = bool(item.get("is_cse"))
        key = (
            item_is_cse,
            (item.get("description") or "").strip().lower(),
            item.get("project_type") or "",
            item.get("procurement_mode") or "",
            item.get("fund_source") or "",
        )
        if key not in consolidation_map:
            consolidation_map[key] = {
                "description": item.get("description"),
                "is_cse": item_is_cse,
                "project_type": item.get("project_type"),
                "procurement_mode": item.get("procurement_mode") or "Competitive Bidding",
                "fund_source": item.get("fund_source"),
                "quantity_size": item.get("quantity_size"),
                "proc_start": item.get("proc_start"),
                "proc_end": item.get("proc_end"),
                "delivery_period": item.get("delivery_period"),
                "pre_proc_conf": bool(item.get("pre_proc_conf")),
                "total_estimated_budget": 0.0,
                "offices": set(),
                "total_quantity": 0,
                "q1_qty": 0,
                "q2_qty": 0,
                "q3_qty": 0,
                "q4_qty": 0,
                "category": item.get("category"),
                "unit_of_measure": item.get("unit_of_measure"),
                "unit_cost": item.get("unit_cost"),
            }

        group = consolidation_map[key]
        group["total_estimated_budget"] += float(item.get("estimated_budget") or 0.0)
        group["total_quantity"] += int(item.get("quantity") or 0)
        group["q1_qty"] += int(item.get("q1_qty") or 0)
        group["q2_qty"] += int(item.get("q2_qty") or 0)
        group["q3_qty"] += int(item.get("q3_qty") or 0)
        group["q4_qty"] += int(item.get("q4_qty") or 0)
        office_code = (item.get("office_code") or "").strip()
        if office_code:
            group["offices"].add(office_code)

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
