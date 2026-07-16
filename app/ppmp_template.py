"""
Per-office NGPA_PPMP.xlsx template management.

Each office keeps its own copy of the shared PPMP layout under
``templates/end-users/{office_code}/NGPA_PPMP.xlsx``. The master file at
``templates/NGPA_PPMP.xlsx`` is never modified — it is copied on first save
and then patched in-place with the office's signatory footer.

Cell layout on sheet ``Indicative PPMP (2)`` (verified against the master):

    A11 = "End-User or Implementing Unit: {office name}"
    B26 = "Prepared by:"                E26 = "Submitted by:"
    B28 = prepared_by (name)            E28 = submitted_by (name)
    B29 = prepared_by_designation       E29 = submitted_by_designation
    B30 = office name (unit label)      E30 = "Head of {office name}"

Public API:
    office_template_path(office)     -> absolute Path to the office xlsx
    ensure_office_template(office)   -> copy master if missing, return path
    write_signatory(office)          -> rewrite signatory footer from Office row
"""

from __future__ import annotations

import os
import re
import shutil
from pathlib import Path
from typing import TYPE_CHECKING

from openpyxl import load_workbook

if TYPE_CHECKING:
    from app.models import Office


REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = REPO_ROOT / "templates"
MASTER_TEMPLATE = TEMPLATES_DIR / "NGPA_PPMP.xlsx"
END_USERS_DIR = TEMPLATES_DIR / "end-users"

PPMP_SHEET = "Indicative PPMP (2)"

# Cells to write (see module docstring).
CELL_PREPARED_NAME = "B28"
CELL_PREPARED_DESIG = "B29"
CELL_PREPARED_UNIT = "B30"
CELL_SUBMITTED_NAME = "E28"
CELL_SUBMITTED_DESIG = "E29"
CELL_SUBMITTED_UNIT = "E30"
CELL_UNIT_HEADER = "A11"


def _safe_dir_name(code: str) -> str:
    """Sanitize an office code for use as a folder name (Windows-safe)."""
    cleaned = re.sub(r"[^A-Za-z0-9_\-]+", "_", (code or "").strip())
    return cleaned or "office"


def office_template_path(office: "Office") -> Path:
    """Return the absolute path where this office's NGPA_PPMP.xlsx lives."""
    return END_USERS_DIR / _safe_dir_name(office.code) / "NGPA_PPMP.xlsx"


def ensure_office_template(office: "Office") -> Path:
    """
    Copy the master NGPA_PPMP.xlsx into the office's folder if it isn't there
    yet. Returns the absolute path to the office file.
    """
    if not MASTER_TEMPLATE.exists():
        raise FileNotFoundError(
            f"Master PPMP template not found at {MASTER_TEMPLATE}"
        )

    dest = office_template_path(office)
    if not dest.exists():
        os.makedirs(dest.parent, exist_ok=True)
        shutil.copy2(MASTER_TEMPLATE, dest)
    return dest


def write_signatory(office: "Office") -> Path:
    """
    Rewrite the signatory footer of the office's NGPA_PPMP.xlsx from the
    values currently stored on the Office row. Returns the file path.
    """
    dest = ensure_office_template(office)

    wb = load_workbook(dest)
    if PPMP_SHEET in wb.sheetnames:
        ws = wb[PPMP_SHEET]
    else:
        ws = wb.worksheets[0]

    office_name = office.name or ""

    ws[CELL_UNIT_HEADER] = f"End-User or Implementing Unit: {office_name}"

    ws[CELL_PREPARED_NAME] = office.prepared_by or ""
    ws[CELL_PREPARED_DESIG] = office.prepared_by_designation or ""
    ws[CELL_PREPARED_UNIT] = office_name

    ws[CELL_SUBMITTED_NAME] = office.submitted_by or ""
    ws[CELL_SUBMITTED_DESIG] = office.submitted_by_designation or ""
    ws[CELL_SUBMITTED_UNIT] = f"Head of {office_name}" if office_name else ""

    wb.save(dest)
    return dest
