"""
Sync indicative PPMP data from Google Sheets (Option B) into PostgreSQL.

Reads the Submission_Status master sheet, then pulls PPMP_Header, Items_CSE, and
Items_nonCSE from each office spreadsheet and upserts into IndicativePPMP +
PPMPItem tables.

Item columns follow the 14-column NGPA_PPMP.xlsx layout:
  row_id | description | project_type | quantity_size | procurement_mode |
  pre_proc_conf | proc_start | proc_end | delivery_period | fund_source |
  estimated_budget | supporting_docs | remarks | locked
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

# 14-column layout matching gas/setup/SheetTemplate.gs setupItemsTab_
ITEM_FIELDS = [
    "row_id",
    "description",
    "project_type",
    "quantity_size",
    "procurement_mode",
    "pre_proc_conf",
    "proc_start",
    "proc_end",
    "delivery_period",
    "fund_source",
    "estimated_budget",
    "supporting_docs",
    "remarks",
    "locked",
]

ITEMS_CSE_RANGE = "Items_CSE!A2:N"
ITEMS_NONCSE_RANGE = "Items_nonCSE!A2:N"


def _get_sheets_service():
    creds = service_account.Credentials.from_service_account_file(
        GOOGLE_SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _read_range(service, spreadsheet_id: str, range_name: str) -> List[List[Any]]:
    try:
        result = (
            service.spreadsheets()
            .values()
            .get(spreadsheetId=spreadsheet_id, range=range_name)
            .execute()
        )
        return result.get("values", [])
    except Exception as e:
        logger.warning("Failed to read %s from %s: %s", range_name, spreadsheet_id, e)
        return []


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


def read_items_range(service, spreadsheet_id: str, range_name: str) -> List[Dict[str, Any]]:
    rows = _read_range(service, spreadsheet_id, range_name)
    items = []
    for row in rows:
        if not row or (len(row) > 1 and not row[1]):
            continue
        item = _row_to_dict(ITEM_FIELDS, row)
        item["row_id"] = _parse_int(item.get("row_id"))
        item["pre_proc_conf"] = _parse_bool(item.get("pre_proc_conf"))
        item["estimated_budget"] = _parse_float(item.get("estimated_budget"))
        item["locked"] = _parse_bool(item.get("locked"))
        items.append(item)
    return items


def read_ppmp_items(
    service, spreadsheet_id: str
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Returns (cse_items, non_cse_items)."""
    cse = read_items_range(service, spreadsheet_id, ITEMS_CSE_RANGE)
    non_cse = read_items_range(service, spreadsheet_id, ITEMS_NONCSE_RANGE)
    return cse, non_cse


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


def _apply_item_fields(db_item: PPMPItem, data: Dict[str, Any], is_cse: bool) -> None:
    db_item.description = str(data.get("description", ""))
    db_item.project_type = str(data.get("project_type", "")) or None
    db_item.quantity_size = str(data.get("quantity_size", "")) or None
    db_item.procurement_mode = str(data.get("procurement_mode", "")) or "Competitive Bidding"
    db_item.pre_proc_conf = bool(data.get("pre_proc_conf", False))
    db_item.proc_start = str(data.get("proc_start", "")) or None
    db_item.proc_end = str(data.get("proc_end", "")) or None
    db_item.delivery_period = str(data.get("delivery_period", "")) or None
    db_item.fund_source = str(data.get("fund_source", "")) or None
    db_item.estimated_budget = float(data.get("estimated_budget", 0.0))
    db_item.supporting_docs = str(data.get("supporting_docs", "")) or None
    db_item.remarks = str(data.get("remarks", "")) or None
    db_item.is_cse = is_cse


def _upsert_items_for_kind(
    session: Session,
    indicative: IndicativePPMP,
    items: List[Dict[str, Any]],
    is_cse: bool,
) -> int:
    existing = session.exec(
        select(PPMPItem).where(
            PPMPItem.indicative_ppmp_id == indicative.id,
            PPMPItem.is_cse == is_cse,
        )
    ).all()
    existing_by_row = {i.sheet_row_id: i for i in existing if i.sheet_row_id is not None}
    synced_row_ids = set()

    for item_data in items:
        row_id = item_data["row_id"]
        synced_row_ids.add(row_id)
        db_item = existing_by_row.get(row_id)

        if not db_item:
            db_item = PPMPItem(
                indicative_ppmp_id=indicative.id,
                sheet_row_id=row_id,
                description="",
                is_cse=is_cse,
            )
            session.add(db_item)

        _apply_item_fields(db_item, item_data, is_cse)

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
                cse_items, non_cse_items = read_ppmp_items(service, spreadsheet_id)

                office = _get_or_create_office(
                    session,
                    code=sub["office_code"],
                    name=header.get("office_name") or sub["office_name"],
                    budget=_parse_float(header.get("budget_allocation")),
                )
                indicative = _upsert_indicative_ppmp(session, office, header, sub, spreadsheet_id)
                _upsert_items_for_kind(session, indicative, cse_items, is_cse=True)
                _upsert_items_for_kind(session, indicative, non_cse_items, is_cse=False)
                synced += 1
                logger.info(
                    "Synced %s (CSE=%d, non-CSE=%d)",
                    sub["office_code"], len(cse_items), len(non_cse_items),
                )
            except Exception as e:
                logger.error("Failed to sync %s: %s", sub["office_code"], str(e))
                session.rollback()
                raise

        session.commit()

    return synced, f"Synced {synced} office PPMP(s) for FY {fiscal_year}"
