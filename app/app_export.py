"""
Generate the three official APP xlsx outputs from consolidated APPRow data.

Uses openpyxl to open the RA 12009 template files in `templates/` and write
consolidated rows into the data area, preserving template formatting and
signatory blocks.

Public API:
    export_cse_app(session, fiscal_year)      -> bytes  (NGPA_CSE-APP.xlsx)
    export_noncse_app(session, fiscal_year)   -> bytes  (NGPA_nonCSE-APP.xlsx)
    export_combined_app(session, fiscal_year) -> bytes  (APP-CSE&nonCSE 2027 Form.xlsx)
"""

from __future__ import annotations

import io
import os
from typing import Iterable, List

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from sqlmodel import Session, select

from app.models import APP, APPRow

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates")

CSE_APP_TEMPLATE = os.path.join(TEMPLATES_DIR, "NGPA_CSE-APP.xlsx")
NONCSE_APP_TEMPLATE = os.path.join(TEMPLATES_DIR, "NGPA_nonCSE-APP.xlsx")
COMBINED_APP_TEMPLATE = os.path.join(TEMPLATES_DIR, "APP-CSE&nonCSE 2027 Form .xlsx")


def _get_app_and_rows(session: Session, fiscal_year: int) -> tuple[APP, List[APPRow]]:
    app = session.exec(select(APP).where(APP.fiscal_year == fiscal_year)).first()
    if not app:
        raise ValueError(f"No consolidated APP found for FY {fiscal_year}. Run consolidation first.")
    rows = session.exec(select(APPRow).where(APPRow.app_id == app.id)).all()
    return app, rows


def _yes_no(value) -> str:
    return "Yes" if value else "No"


def _thin_border() -> Border:
    side = Side(style="thin", color="666666")
    return Border(left=side, right=side, top=side, bottom=side)


def _style_row(ws, row: int, first_col: int, last_col: int, wrap: bool = True) -> None:
    border = _thin_border()
    for c in range(first_col, last_col + 1):
        cell = ws.cell(row=row, column=c)
        cell.border = border
        cell.alignment = Alignment(wrap_text=wrap, vertical="top")


def export_cse_app(session: Session, fiscal_year: int) -> bytes:
    """Fill NGPA_CSE-APP.xlsx template with CSE APPRow entries."""
    app, all_rows = _get_app_and_rows(session, fiscal_year)
    cse_rows = [r for r in all_rows if r.is_cse]

    wb = load_workbook(CSE_APP_TEMPLATE)
    ws = wb.worksheets[0]

    # Fiscal year header at R3C3
    header_cell = ws.cell(row=3, column=3)
    if header_cell.value and "____" in str(header_cell.value):
        header_cell.value = str(header_cell.value).replace("______", str(fiscal_year))
    else:
        header_cell.value = f"ANNUAL PROCUREMENT PLAN FOR FY {fiscal_year}"

    # Data start row 11 (below template header + PAP code sample)
    start_row = 11
    for i, row in enumerate(cse_rows):
        r = start_row + i
        ws.cell(row=r, column=1, value=row.project_type or "Goods")   # PAP Code / group label
        ws.cell(row=r, column=3, value=row.description)                # General Requirements
        ws.cell(row=r, column=4, value=row.end_user_offices or "")     # End-User / Implementing Unit
        ws.cell(row=r, column=5, value=row.description)                # General Description of the Project
        ws.cell(row=r, column=6, value=row.description)                # General Description of the Procurement Project
        ws.cell(row=r, column=7, value=row.procurement_mode)           # Mode of Procurement
        ws.cell(row=r, column=8, value=_yes_no(row.pre_proc_conf))     # EPA Yes/No
        ws.cell(row=r, column=10, value=row.proc_start or "")          # Start of Procurement Activity
        ws.cell(row=r, column=11, value=row.proc_end or "")            # End of Procurement Activity
        ws.cell(row=r, column=12, value=row.fund_source or "")         # Source of Fund
        ws.cell(row=r, column=13, value=float(row.total_estimated_budget or 0))
        ws.cell(row=r, column=13).number_format = "#,##0.00"
        ws.cell(row=r, column=15, value=row.quantity_size or "")       # Remarks column at col 15
        _style_row(ws, r, 1, 15)

    total = sum(float(r.total_estimated_budget or 0) for r in cse_rows)
    total_row = start_row + len(cse_rows) + 1
    ws.cell(row=total_row, column=10, value=f"TOTAL CSE ESTIMATED BUDGET (FY {fiscal_year})").font = Font(bold=True)
    ws.cell(row=total_row, column=13, value=total).number_format = "#,##0.00"
    ws.cell(row=total_row, column=13).font = Font(bold=True)

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream.getvalue()


def export_noncse_app(session: Session, fiscal_year: int) -> bytes:
    """Fill NGPA_nonCSE-APP.xlsx template with non-CSE APPRow entries."""
    app, all_rows = _get_app_and_rows(session, fiscal_year)
    non_cse_rows = [r for r in all_rows if not r.is_cse]

    wb = load_workbook(NONCSE_APP_TEMPLATE)
    ws = wb.worksheets[0]

    # Header at R1C3
    header_cell = ws.cell(row=1, column=3)
    if header_cell.value and "____" in str(header_cell.value):
        header_cell.value = str(header_cell.value).replace("______", str(fiscal_year))
    else:
        header_cell.value = f"(Ormoc City Government) Annual Procurement Plan for FY {fiscal_year}"

    start_row = 5
    for i, row in enumerate(non_cse_rows):
        r = start_row + i
        ws.cell(row=r, column=1, value=row.project_type or "")         # PAP Code
        ws.cell(row=r, column=2, value=row.description)                # Procurement Project
        ws.cell(row=r, column=3, value=row.end_user_offices or "")     # PMO / End-User
        ws.cell(row=r, column=4, value=_yes_no(row.pre_proc_conf))     # Early Procurement?
        ws.cell(row=r, column=5, value=row.procurement_mode)           # Mode of Procurement
        ws.cell(row=r, column=6, value=row.proc_start or "")           # Adv/Posting of IB/REI
        ws.cell(row=r, column=7, value=row.proc_end or "")             # Submission/Opening of Bids
        ws.cell(row=r, column=10, value=row.fund_source or "")         # Source of Funds
        ws.cell(row=r, column=12, value=float(row.total_estimated_budget or 0))
        ws.cell(row=r, column=12).number_format = "#,##0.00"
        ws.cell(row=r, column=14, value=row.quantity_size or "")       # Remarks
        _style_row(ws, r, 1, 14)

    total = sum(float(r.total_estimated_budget or 0) for r in non_cse_rows)
    total_row = start_row + len(non_cse_rows) + 1
    ws.cell(row=total_row, column=1, value=f"TOTAL NON-CSE ESTIMATED BUDGET (FY {fiscal_year})").font = Font(bold=True)
    ws.cell(row=total_row, column=11, value=total).number_format = "#,##0.00"
    ws.cell(row=total_row, column=11).font = Font(bold=True)

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream.getvalue()


def export_combined_app(session: Session, fiscal_year: int) -> bytes:
    """
    Fill the combined APP form template. The official APP-CSE&nonCSE 2027 form
    is a PS-DBM catalog fill-in workbook. We update the year and append a
    consolidated summary sheet with all CSE + non-CSE APPRow entries so BAC
    admin has a single spreadsheet with both.
    """
    app, all_rows = _get_app_and_rows(session, fiscal_year)

    wb = load_workbook(COMBINED_APP_TEMPLATE)
    ws = wb.worksheets[0]

    # Update fiscal year references in title/reminders (rows 1-22 area)
    for r in range(1, 25):
        for c in range(1, 5):
            cell = ws.cell(row=r, column=c)
            if isinstance(cell.value, str) and "2027" in cell.value:
                cell.value = cell.value.replace("2027", str(fiscal_year))

    # Append a summary sheet with the consolidated CSE + non-CSE view
    summary = wb.create_sheet(title=f"Consolidated APP FY{fiscal_year}")
    summary.append([
        "Kind", "Description", "Project Type", "Quantity/Size",
        "Procurement Mode", "Fund Source",
        "Start of Procurement (MM/YYYY)", "End of Procurement (MM/YYYY)",
        "Delivery Period", "Early Procurement? (Yes/No)",
        "End-User Offices", "Estimated Budget (PhP)"
    ])
    header_fill = PatternFill(start_color="1B5E3B", end_color="1B5E3B", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")
    for c in range(1, 13):
        cell = summary.cell(row=1, column=c)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
    summary.freeze_panes = "A2"

    def _emit_rows(rows: Iterable[APPRow], kind_label: str) -> float:
        total = 0.0
        for row in rows:
            budget = float(row.total_estimated_budget or 0)
            total += budget
            summary.append([
                kind_label,
                row.description,
                row.project_type or "",
                row.quantity_size or "",
                row.procurement_mode,
                row.fund_source or "",
                row.proc_start or "",
                row.proc_end or "",
                row.delivery_period or "",
                _yes_no(row.pre_proc_conf),
                row.end_user_offices or "",
                budget,
            ])
        return total

    cse_rows = [r for r in all_rows if r.is_cse]
    non_cse_rows = [r for r in all_rows if not r.is_cse]
    cse_total = _emit_rows(cse_rows, "CSE")
    non_cse_total = _emit_rows(non_cse_rows, "Non-CSE")

    end_row = summary.max_row + 2
    summary.cell(row=end_row, column=1, value="TOTAL CSE").font = Font(bold=True)
    summary.cell(row=end_row, column=12, value=cse_total).number_format = "#,##0.00"
    summary.cell(row=end_row, column=12).font = Font(bold=True)
    summary.cell(row=end_row + 1, column=1, value="TOTAL NON-CSE").font = Font(bold=True)
    summary.cell(row=end_row + 1, column=12, value=non_cse_total).number_format = "#,##0.00"
    summary.cell(row=end_row + 1, column=12).font = Font(bold=True)
    summary.cell(row=end_row + 2, column=1, value=f"GRAND TOTAL FY {fiscal_year}").font = Font(bold=True)
    summary.cell(row=end_row + 2, column=12, value=cse_total + non_cse_total).number_format = "#,##0.00"
    summary.cell(row=end_row + 2, column=12).font = Font(bold=True)

    for col_letter, width in [
        ("A", 12), ("B", 40), ("C", 18), ("D", 20), ("E", 24), ("F", 20),
        ("G", 16), ("H", 16), ("I", 18), ("J", 18), ("K", 26), ("L", 18),
    ]:
        summary.column_dimensions[col_letter].width = width

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream.getvalue()
