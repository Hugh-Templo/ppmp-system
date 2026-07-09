"""
Sync indicative PPMP data from Google Sheets (Option B) into PostgreSQL.

Reads the Submission_Status master sheet, then pulls PPMP_Header and PPMP_Items
from each office spreadsheet and upserts into IndicativePPMP + PPMPItem tables.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from google.oauth2 import service_account
from googleapiclient.discovery import build
from sqlmodel import Session, select

from app.config import (
    GOOGLE_MASTER_SPREADSHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_FILE,
    GOOGLE_SYNC_FISCAL_YEAR,
)
from app.database import engine
from app.models import IndicativePPMP, Office, PPMPItem

logger = logging.getLogger("sheets_sync")

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

HEADER_FIELDS = [
    "office_code",
    "office_name",
    "fiscal_year",
    "title",
    "type",
    "status",
    "posting_status",
    "budget_allocation",
    "total_estimated_budget",
    "remarks",
    "is_editable",
    "edit_lock_reason",
    "submitted_at",
    "reviewed_at",
    "posted_at",
    "spreadsheet_id",
]

ITEM_FIELDS = [
    "row_id",
    "description",
    "category",
    "is_cse",
    "quantity",
    "unit_of_measure",
    "unit_cost",
    "estimated_budget",
    "procurement_mode",
    "q1_qty",
    "q2_qty",
    "q3_qty",
    "q4_qty",
    "locked",
]


def _get_sheets_service():
    creds = service_account.Credentials.from_service_account_file(
        GOOGLE_SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _read_range(service, spreadsheet_id: str, range_name: str) -> List[List[Any]]:
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=range_name)
        .execute()
    )
    return result.get("values", [])


def _parse_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    return str(val).strip().upper() in ("TRUE", "YES", "1")


def _parse_float(val: Any) -> float:
    try:
        return float(val) if val not in (None, "") else 0.0
    except (ValueError, TypeError):
        return 0.0


def _parse_int(val: Any) -> int:
    try:
        return int(float(val)) if val not in (None, "") else 0
    except (ValueError, TypeError):
        return 0


def _row_to_dict(headers: List[str], row: List[Any]) -> Dict[str, Any]:
    padded = row + [""] * (len(headers) - len(row))
    return dict(zip(headers, padded))


def read_submission_status(service) -> List[Dict[str, Any]]:
    rows = _read_range(service, GOOGLE_MASTER_SPREADSHEET_ID, "Submission_Status!A2:K")
    submissions = []
    for row in rows:
        if not row or not row[0]:
            continue
        submissions.append(
            {
                "office_code": str(row[0]),
                "office_name": str(row[1]) if len(row) > 1 else "",
                "fiscal_year": _parse_int(row[2]) if len(row) > 2 else GOOGLE_SYNC_FISCAL_YEAR,
                "spreadsheet_id": str(row[3]) if len(row) > 3 else "",
                "status": str(row[4]) if len(row) > 4 else "Draft",
                "posting_status": str(row[5]) if len(row) > 5 else "Draft",
                "total_estimated_budget": _parse_float(row[6]) if len(row) > 6 else 0.0,
            }
        )
    return submissions


def read_ppmp_header(service, spreadsheet_id: str) -> Dict[str, Any]:
    rows = _read_range(service, spreadsheet_id, "PPMP_Header!A2:P2")
    if not rows or not rows[0]:
        return {}
    return _row_to_dict(HEADER_FIELDS, rows[0])


def read_ppmp_items(service, spreadsheet_id: str) -> List[Dict[str, Any]]:
    rows = _read_range(service, spreadsheet_id, "PPMP_Items!A2:N")
    items = []
    for row in rows:
        if not row or (len(row) > 1 and not row[1]):
            continue
        item = _row_to_dict(ITEM_FIELDS, row)
        item["is_cse"] = _parse_bool(item.get("is_cse"))
        item["quantity"] = _parse_int(item.get("quantity"))
        item["unit_cost"] = _parse_float(item.get("unit_cost"))
        item["estimated_budget"] = _parse_float(item.get("estimated_budget"))
        item["q1_qty"] = _parse_int(item.get("q1_qty"))
        item["q2_qty"] = _parse_int(item.get("q2_qty"))
        item["q3_qty"] = _parse_int(item.get("q3_qty"))
        item["q4_qty"] = _parse_int(item.get("q4_qty"))
        item["row_id"] = _parse_int(item.get("row_id"))
        items.append(item)
    return items


def _get_or_create_office(session: Session, code: str, name: str, budget: float) -> Office:
    office = session.exec(select(Office).where(Office.code == code)).first()
    if office:
        office.name = name or office.name
        if budget > 0:
            office.budget_allocation = budget
        session.add(office)
        return office
    office = Office(code=code, name=name or code, budget_allocation=budget)
    session.add(office)
    session.flush()
    return office


def _upsert_indicative_ppmp(
    session: Session,
    office: Office,
    header: Dict[str, Any],
    submission: Dict[str, Any],
    spreadsheet_id: str,
) -> IndicativePPMP:
    indicative = session.exec(
        select(IndicativePPMP).where(
            IndicativePPMP.office_id == office.id,
            IndicativePPMP.fiscal_year == _parse_int(header.get("fiscal_year", GOOGLE_SYNC_FISCAL_YEAR)),
        )
    ).first()

    if not indicative:
        indicative = IndicativePPMP(
            title=str(header.get("title", f"Indicative PPMP {GOOGLE_SYNC_FISCAL_YEAR}")),
            fiscal_year=_parse_int(header.get("fiscal_year", GOOGLE_SYNC_FISCAL_YEAR)),
            office_id=office.id,
        )

    indicative.title = str(header.get("title", indicative.title))
    indicative.status = str(header.get("status", submission.get("status", "Draft")))
    indicative.posting_status = str(
        header.get("posting_status", submission.get("posting_status", "Draft"))
    )
    indicative.remarks = str(header.get("remarks", "")) or None
    indicative.spreadsheet_id = spreadsheet_id
    indicative.updated_at = datetime.utcnow()

    session.add(indicative)
    session.flush()
    return indicative


def _upsert_items(
    session: Session,
    indicative: IndicativePPMP,
    items: List[Dict[str, Any]],
) -> int:
    existing = session.exec(
        select(PPMPItem).where(PPMPItem.indicative_ppmp_id == indicative.id)
    ).all()
    existing_by_row = {i.sheet_row_id: i for i in existing if i.sheet_row_id is not None}
    synced_row_ids = set()

    for item_data in items:
        row_id = item_data["row_id"]
        synced_row_ids.add(row_id)
        db_item = existing_by_row.get(row_id)

        if not db_item:
            db_item = PPMPItem(indicative_ppmp_id=indicative.id, sheet_row_id=row_id, description="")
            session.add(db_item)

        db_item.description = str(item_data.get("description", ""))
        db_item.category = str(item_data.get("category", "Office Supplies"))
        db_item.is_cse = item_data.get("is_cse", False)
        db_item.quantity = item_data.get("quantity", 0)
        db_item.unit_of_measure = str(item_data.get("unit_of_measure", "pc"))
        db_item.unit_cost = item_data.get("unit_cost", 0.0)
        db_item.estimated_budget = item_data.get("estimated_budget", 0.0)
        db_item.procurement_mode = str(item_data.get("procurement_mode", "Shopping"))
        db_item.q1_qty = item_data.get("q1_qty", 0)
        db_item.q2_qty = item_data.get("q2_qty", 0)
        db_item.q3_qty = item_data.get("q3_qty", 0)
        db_item.q4_qty = item_data.get("q4_qty", 0)

    for row_id, db_item in existing_by_row.items():
        if row_id not in synced_row_ids:
            session.delete(db_item)

    return len(items)


def sync_from_sheets(fiscal_year: Optional[int] = None) -> Tuple[int, str]:
    """
    Pull all office PPMPs from Google Sheets and upsert into PostgreSQL.
    Returns (offices_synced_count, message).
    """
    if not GOOGLE_MASTER_SPREADSHEET_ID:
        return 0, "GOOGLE_MASTER_SPREADSHEET_ID not configured"

    fiscal_year = fiscal_year or GOOGLE_SYNC_FISCAL_YEAR
    service = _get_sheets_service()
    submissions = read_submission_status(service)

    synced = 0
    with Session(engine) as session:
        for sub in submissions:
            if sub["fiscal_year"] != fiscal_year:
                continue
            spreadsheet_id = sub.get("spreadsheet_id")
            if not spreadsheet_id:
                logger.warning("No spreadsheet_id for %s", sub["office_code"])
                continue

            try:
                header = read_ppmp_header(service, spreadsheet_id)
                items = read_ppmp_items(service, spreadsheet_id)

                office = _get_or_create_office(
                    session,
                    code=sub["office_code"],
                    name=header.get("office_name") or sub["office_name"],
                    budget=_parse_float(header.get("budget_allocation")),
                )
                indicative = _upsert_indicative_ppmp(session, office, header, sub, spreadsheet_id)
                _upsert_items(session, indicative, items)
                synced += 1
                logger.info("Synced %s (%d items)", sub["office_code"], len(items))
            except Exception as e:
                logger.error("Failed to sync %s: %s", sub["office_code"], str(e))
                session.rollback()
                raise

        session.commit()

    return synced, f"Synced {synced} office PPMP(s) for FY {fiscal_year}"
