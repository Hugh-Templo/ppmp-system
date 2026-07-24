"""
Generate the three official APP xlsx outputs from consolidated APPRow data.

Fills RA 12009 templates under ``templates/`` while preserving section headers,
totals, and signatory blocks (insert rows instead of overwriting the form).

Public API:
    export_cse_app(session, fiscal_year)      -> bytes  (NGPA_CSE-APP.xlsx)
    export_noncse_app(session, fiscal_year)   -> bytes  (NGPA_nonCSE-APP.xlsx)
    export_combined_app(session, fiscal_year) -> bytes  (APP-CSE&nonCSE 2027 Form.xlsx)
"""

from __future__ import annotations

import io
import os
import re
from copy import copy
from typing import Iterable, List, Optional

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


def _clone_row_style(ws, src_row: int, dst_row: int, last_col: int) -> None:
    ws.row_dimensions[dst_row].height = ws.row_dimensions[src_row].height
    for c in range(1, last_col + 1):
        src = ws.cell(row=src_row, column=c)
        dst = ws.cell(row=dst_row, column=c)
        if src.has_style:
            dst.font = copy(src.font)
            dst.border = copy(src.border)
            dst.fill = copy(src.fill)
            dst.number_format = src.number_format
            dst.protection = copy(src.protection)
            dst.alignment = copy(src.alignment)


def _apply_data_style(ws, row: int, first_col: int, last_col: int) -> None:
    border = _thin_border()
    for c in range(first_col, last_col + 1):
        cell = ws.cell(row=row, column=c)
        cell.border = border
        cell.alignment = Alignment(wrap_text=True, vertical="top")


def _find_row_containing(ws, text: str, max_row: int = 80, max_col: int = 16) -> Optional[int]:
    needle = text.lower()
    for r in range(1, max_row + 1):
        for c in range(1, max_col + 1):
            val = ws.cell(row=r, column=c).value
            if isinstance(val, str) and needle in val.lower():
                return r
    return None


def _set_fiscal_year_header(cell, fiscal_year: int, fallback: str) -> None:
    val = cell.value
    if isinstance(val, str) and ("____" in val or "20" in val):
        updated = re.sub(r"20\d{2}", str(fiscal_year), val)
        updated = updated.replace("______", str(fiscal_year)).replace("____", str(fiscal_year))
        cell.value = updated
    else:
        cell.value = fallback


def _write_cse_data_row(ws, r: int, row: APPRow) -> None:
    """Map APPRow into NGPA_CSE-APP columns (Guide + header row 7)."""
    title = row.description or ""
    qty = row.quantity_size or ""
    ws.cell(row=r, column=1, value="")  # PAP Code (optional)
    ws.cell(row=r, column=2, value="")  # Object Code
    ws.cell(row=r, column=3, value=title)  # Project Title
    ws.cell(row=r, column=4, value=row.end_user_offices or "")  # End-User
    ws.cell(row=r, column=5, value=row.category or title)  # General Description of Project
    ws.cell(row=r, column=6, value=qty or title)  # General Description of Procurement Project
    ws.cell(row=r, column=7, value=row.procurement_mode or "")  # Mode
    ws.cell(row=r, column=8, value=_yes_no(row.pre_proc_conf))  # EPA
    ws.cell(row=r, column=9, value="")  # Criteria for Bid Evaluation
    ws.cell(row=r, column=10, value=row.proc_start or "")  # Start
    ws.cell(row=r, column=11, value=row.proc_end or "")  # End
    ws.cell(row=r, column=12, value=row.fund_source or "")  # Source of Fund
    budget_cell = ws.cell(row=r, column=13, value=float(row.total_estimated_budget or 0))
    budget_cell.number_format = "#,##0.00"
    ws.cell(row=r, column=14, value="")  # Procurement Strategy / Tools
    ws.cell(
        row=r,
        column=15,
        value=row.delivery_period or row.quantity_size or "",
    )  # Remarks
    _apply_data_style(ws, r, 1, 15)


def export_cse_app(session: Session, fiscal_year: int) -> bytes:
    """Fill NGPA_CSE-APP.xlsx under the CSE / PS-DBM section, keeping signatories."""
    _app, all_rows = _get_app_and_rows(session, fiscal_year)
    cse_rows = [r for r in all_rows if r.is_cse]

    wb = load_workbook(CSE_APP_TEMPLATE)
    ws = wb.worksheets[0]

    # Letterhead + FY title
    letter = ws.cell(row=2, column=3)
    if not letter.value or "letterhead" in str(letter.value).lower():
        letter.value = "Ormoc City Government"
    _set_fiscal_year_header(
        ws.cell(row=3, column=3),
        fiscal_year,
        f"ANNUAL PROCUREMENT PLAN FOR FY {fiscal_year}",
    )

    # Mark FINAL
    type_cell = ws.cell(row=4, column=3)
    if isinstance(type_cell.value, str):
        type_cell.value = (
            "   INDICATIVE               ✓ FINAL               UPDATED"
        )

    # CSE section header (do not write into Early Procurement / General Requirements)
    cse_header = _find_row_containing(ws, "Common Use Supplies and Equipment (CSE)") or 22
    data_start = cse_header + 1
    # Template has two placeholder rows under the CSE header before the note line.
    note_row = _find_row_containing(ws, "Insert additional rows") or (data_start + 2)
    placeholder_slots = max(1, note_row - data_start)
    n = len(cse_rows)
    extra = max(0, n - placeholder_slots)
    if extra:
        ws.insert_rows(note_row, amount=extra)
        for offset in range(extra):
            _clone_row_style(ws, data_start, note_row + offset, 15)

    # Clear leftover formulas / sample text in the data band
    band_end = data_start + max(n, placeholder_slots) - 1
    for r in range(data_start, band_end + 1):
        for c in range(1, 16):
            ws.cell(row=r, column=c).value = None

    for i, row in enumerate(cse_rows):
        _write_cse_data_row(ws, data_start + i, row)

    total = sum(float(r.total_estimated_budget or 0) for r in cse_rows)

    # Fill template total labels (shifted if rows were inserted)
    cse_total_row = _find_row_containing(ws, "CSEs to be purchased from PS-DBM")
    if cse_total_row:
        amount = ws.cell(row=cse_total_row, column=13, value=total)
        amount.number_format = "#,##0.00"
        amount.font = Font(bold=True)

    # Prefer the exact grand-total label (avoid the EPA Projects line)
    grand_row = None
    for r in range(1, min(ws.max_row, 80) + 1):
        for c in range(1, 16):
            val = ws.cell(row=r, column=c).value
            if not isinstance(val, str):
                continue
            low = val.lower()
            if "total amount of estimated budget" in low and "epa" not in low:
                grand_row = r
                break
        if grand_row:
            break
    if grand_row:
        amount = ws.cell(row=grand_row, column=13, value=total)
        amount.number_format = "#,##0.00"
        amount.font = Font(bold=True)

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream.getvalue()


def _write_noncse_data_row(ws, r: int, row: APPRow) -> None:
    ws.cell(row=r, column=1, value=row.project_type or "")  # Code (PAP)
    ws.cell(row=r, column=2, value=row.description or "")  # Procurement Project
    ws.cell(row=r, column=3, value=row.end_user_offices or "")  # PMO / End-User
    ws.cell(row=r, column=4, value=_yes_no(row.pre_proc_conf))  # EPA
    ws.cell(row=r, column=5, value=row.procurement_mode or "")  # Mode
    ws.cell(row=r, column=6, value=row.proc_start or "")  # Advertisement/Posting
    ws.cell(row=r, column=7, value=row.proc_start or "")  # Submission/Opening
    ws.cell(row=r, column=8, value=row.proc_end or "")  # Notice of Award
    ws.cell(row=r, column=9, value=row.delivery_period or "")  # Contract Signing
    ws.cell(row=r, column=10, value=row.fund_source or "")  # Source of Funds
    # Keep / restore Total formula in col 11; put amount in MOOE (col 12)
    ws.cell(
        row=r,
        column=11,
        value=f'=IF(AND(L{r}="",M{r}=""),"",SUM(L{r},M{r}))',
    )
    mooe = ws.cell(row=r, column=12, value=float(row.total_estimated_budget or 0))
    mooe.number_format = "#,##0.00"
    ws.cell(row=r, column=13, value=None)  # CO
    ws.cell(
        row=r,
        column=14,
        value=row.quantity_size or "",
    )  # Remarks
    _apply_data_style(ws, r, 1, 14)


def export_noncse_app(session: Session, fiscal_year: int) -> bytes:
    """Fill NGPA_nonCSE-APP.xlsx data rows without breaking Total formulas/signatories."""
    _app, all_rows = _get_app_and_rows(session, fiscal_year)
    non_cse_rows = [r for r in all_rows if not r.is_cse]

    wb = load_workbook(NONCSE_APP_TEMPLATE)
    ws = wb.worksheets[0]

    _set_fiscal_year_header(
        ws.cell(row=1, column=3),
        fiscal_year,
        f"(Ormoc City Government) Annual Procurement Plan for FY {fiscal_year}",
    )
    header = ws.cell(row=1, column=3)
    if isinstance(header.value, str) and "Name of Agency" in header.value:
        header.value = header.value.replace("Name of Agency", "Ormoc City Government")

    data_start = 5
    # Built-in slots run until the SUBTOTAL row (~24)
    total_label_row = _find_row_containing(ws, "Total") or 24
    # Prefer the row that has SUBTOTAL formulas
    for r in range(data_start, min(ws.max_row, 40) + 1):
        val = ws.cell(row=r, column=11).value
        if isinstance(val, str) and "SUBTOTAL" in val.upper():
            total_label_row = r
            break

    placeholder_slots = max(1, total_label_row - data_start)
    n = len(non_cse_rows)
    extra = max(0, n - placeholder_slots)
    if extra:
        ws.insert_rows(total_label_row, amount=extra)
        for offset in range(extra):
            _clone_row_style(ws, data_start, total_label_row + offset, 14)
        total_label_row += extra

    band_end = data_start + max(n, placeholder_slots) - 1
    for r in range(data_start, band_end + 1):
        for c in range(1, 15):
            ws.cell(row=r, column=c).value = None

    for i, row in enumerate(non_cse_rows):
        _write_noncse_data_row(ws, data_start + i, row)

    # Extend empty reserved rows with Total formulas so sheet stays consistent
    for r in range(data_start + n, band_end + 1):
        ws.cell(
            row=r,
            column=11,
            value=f'=IF(AND(L{r}="",M{r}=""),"",SUM(L{r},M{r}))',
        )

    # Fix SUBTOTAL ranges on the total row to cover the data band
    last_data = data_start + max(n, 1) - 1
    if n == 0:
        last_data = data_start
    ws.cell(row=total_label_row, column=1, value="Total")
    ws.cell(
        row=total_label_row,
        column=2,
        value=f"=SUBTOTAL(103,app!$B${data_start}:$B${last_data})",
    )
    for col, letter in ((11, "K"), (12, "L"), (13, "M")):
        cell = ws.cell(
            row=total_label_row,
            column=col,
            value=f"=SUBTOTAL(109,app!${letter}${data_start}:${letter}${last_data})",
        )
        cell.number_format = "#,##0.00"
        cell.font = Font(bold=True)

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
    _app, all_rows = _get_app_and_rows(session, fiscal_year)

    wb = load_workbook(COMBINED_APP_TEMPLATE)
    ws = wb.worksheets[0]

    for r in range(1, 25):
        for c in range(1, 5):
            cell = ws.cell(row=r, column=c)
            if isinstance(cell.value, str) and "2027" in cell.value:
                cell.value = cell.value.replace("2027", str(fiscal_year))

    summary = wb.create_sheet(title=f"Consolidated APP FY{fiscal_year}")
    summary.append(
        [
            "Kind",
            "Description",
            "Project Type",
            "Quantity/Size",
            "Procurement Mode",
            "Fund Source",
            "Start of Procurement (MM/YYYY)",
            "End of Procurement (MM/YYYY)",
            "Delivery Period",
            "Early Procurement? (Yes/No)",
            "End-User Offices",
            "Estimated Budget (PhP)",
        ]
    )
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
            summary.append(
                [
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
                ]
            )
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
    summary.cell(row=end_row + 2, column=1, value=f"GRAND TOTAL FY {fiscal_year}").font = Font(
        bold=True
    )
    summary.cell(row=end_row + 2, column=12, value=cse_total + non_cse_total).number_format = (
        "#,##0.00"
    )
    summary.cell(row=end_row + 2, column=12).font = Font(bold=True)

    for col_letter, width in [
        ("A", 12),
        ("B", 40),
        ("C", 18),
        ("D", 20),
        ("E", 24),
        ("F", 20),
        ("G", 16),
        ("H", 16),
        ("I", 18),
        ("J", 18),
        ("K", 26),
        ("L", 18),
    ]:
        summary.column_dimensions[col_letter].width = width

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream.getvalue()
