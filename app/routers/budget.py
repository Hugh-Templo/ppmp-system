from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from datetime import datetime
from pathlib import Path
import logging

from app.database import get_session
from app.models import User, PPMP, Office, IndicativePPMP, FinalPPMP
from app.auth import check_role
from app.config import IT_PPMPS_DIR, drive_office_folder_name
from app.drive_sync import (
    delete_ppmp_from_drive,
    push_ppmp_to_drive,
)
from app.file_ppmps import KIND_FOLDER, ensure_it_ppmps_dirs
from app.ppmp_template import export_ppmp_xlsx

router = APIRouter(prefix="/api/budget", tags=["budget"])
logger = logging.getLogger("budget")


def _posted_ppmp_filename(ppmp: PPMP) -> str:
    """Stable Excel name per office/year/kind for Drive CSE-PPMP / nonCSE-PPMP."""
    kind = "CSE" if ppmp.is_cse else "nonCSE"
    return f"NGPA_PPMP_FY{ppmp.fiscal_year}_{kind}.xlsx"


def _materialize_posted_ppmp_file(office: Office, ppmp: PPMP) -> Path:
    """
    Write validated PPMP Excel under IT_ppmps/{CSE|nonCSE}/{office}/ with a
    stable filename so BAC sync/consolidate-from-files can pick it up.
    """
    ensure_it_ppmps_dirs()
    kind_key = "cse" if ppmp.is_cse else "noncse"
    short = drive_office_folder_name(office.code)
    office_folder = IT_PPMPS_DIR / KIND_FOLDER[kind_key] / short
    office_folder.mkdir(parents=True, exist_ok=True)
    dest = office_folder / _posted_ppmp_filename(ppmp)
    content = export_ppmp_xlsx(office, ppmp, ppmp.items or [])
    dest.write_bytes(content)
    return dest


def _push_posted_ppmp_to_drive(office: Office, ppmp: PPMP) -> dict:
    kind_key = "cse" if ppmp.is_cse else "noncse"
    local_path = _materialize_posted_ppmp_file(office, ppmp)
    drive = push_ppmp_to_drive(local_path, kind_key, office.code)
    return {
        "local_path": str(local_path),
        "filename": local_path.name,
        "kind": kind_key,
        "drive_folder": "CSE-PPMP" if kind_key == "cse" else "nonCSE-PPMP",
        "drive_sync": drive,
    }


def _remove_posted_ppmp_from_drive(office: Office, ppmp: PPMP) -> dict:
    kind_key = "cse" if ppmp.is_cse else "noncse"
    filename = _posted_ppmp_filename(ppmp)
    drive = delete_ppmp_from_drive(filename, kind_key, office.code)
    # Drop the stable local posted copy; end-user upload files remain if any.
    try:
        short = drive_office_folder_name(office.code)
        local = IT_PPMPS_DIR / KIND_FOLDER[kind_key] / short / filename
        if local.is_file():
            local.unlink()
    except OSError as exc:
        logger.warning("Could not remove local posted PPMP %s: %s", filename, exc)
    return {
        "filename": filename,
        "kind": kind_key,
        "drive_folder": "CSE-PPMP" if kind_key == "cse" else "nonCSE-PPMP",
        "drive_sync": drive,
    }

@router.get("/pending", response_model=List[PPMP])
def list_pending_ppmps(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office", "bac_admin"])),
):
    """List PPMPs pending budget review for the budget office, or approved PPMPs for BAC admin review."""
    if current_user.role == "bac_admin":
        return session.exec(
            select(PPMP).where(PPMP.status == "Approved")
        ).all()

    return session.exec(
        select(PPMP).where(PPMP.status == "Pending Budget Review")
    ).all()


@router.get("/indicative/pending", response_model=List[IndicativePPMP])
def list_pending_indicative_ppmps(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """List all indicative PPMPs pending BAC admin approval."""
    return session.exec(
        select(IndicativePPMP).where(IndicativePPMP.posting_status == "Posted")
    ).all()


@router.get("/indicative", response_model=List[IndicativePPMP])
def list_indicative_ppmps(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office"])),
):
    """List all indicative PPMPs for budget office posting management."""
    return session.exec(select(IndicativePPMP)).all()


@router.get("/final")
def list_final_ppmps(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office"])),
):
    """
    List Final PPMPs that end users have Submitted or Approved.
    Read-only view for Budget Office monitoring (RA 12009 Phase 4).
    Includes office_name and a supplemental flag for v2+ revisions.
    """
    rows = session.exec(
        select(FinalPPMP, Office)
        .join(Office, Office.id == FinalPPMP.office_id)
        .where(FinalPPMP.approval_status.in_(["Submitted", "Approved"]))
        .order_by(FinalPPMP.office_id, FinalPPMP.fiscal_year.desc(), FinalPPMP.version.desc())
    ).all()

    return [
        {
            "id": ppmp.id,
            "title": ppmp.title,
            "fiscal_year": ppmp.fiscal_year,
            "office_id": ppmp.office_id,
            "office_name": office.name,
            "version": ppmp.version,
            "is_supplemental": ppmp.version >= 2,
            "approval_status": ppmp.approval_status,
            "submitted_at": ppmp.submitted_at,
            "approved_at": ppmp.approved_at,
            "remarks": ppmp.remarks,
        }
        for ppmp, office in rows
    ]


@router.get("/ppmps/posting")
def list_ppmps_for_posting(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office", "bac_admin"])),
):
    """
    List office PPMPs for Budget Post-to-BAC management and BAC verification:
    - Approved + Draft posting (ready to post)
    - Approved + Posted (can unpost for end-user revision)
    """
    rows = session.exec(
        select(PPMP, Office)
        .join(Office, Office.id == PPMP.office_id)
        .where(PPMP.status == "Approved")
        .order_by(PPMP.fiscal_year.desc(), Office.name, PPMP.is_cse.desc())
    ).all()

    return [
        {
            "id": ppmp.id,
            "title": ppmp.title,
            "fiscal_year": ppmp.fiscal_year,
            "office_id": ppmp.office_id,
            "office_name": office.name,
            "is_cse": bool(ppmp.is_cse),
            "status": ppmp.status,
            "posting_status": ppmp.posting_status or "Draft",
            "posted_at": ppmp.posted_at,
            "remarks": ppmp.remarks,
        }
        for ppmp, office in rows
    ]


@router.post("/ppmps/{ppmp_id}/post")
def post_ppmp(
    ppmp_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office"])),
):
    """
    Post a Budget-validated (Approved) office PPMP to BAC for consolidation.
    Writes the Excel under IT_ppmps/{CSE|nonCSE}/{office}/ and uploads it to
    Drive CSE-PPMP or nonCSE-PPMP so BAC can consolidate-from-files.
    """
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    if ppmp.status != "Approved":
        raise HTTPException(
            status_code=400,
            detail="Only Budget-validated (Approved) PPMPs can be posted to BAC",
        )

    if (ppmp.posting_status or "Draft") == "Posted":
        raise HTTPException(status_code=400, detail="PPMP is already posted to BAC")

    office = session.get(Office, ppmp.office_id)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    try:
        drive_result = _push_posted_ppmp_to_drive(office, ppmp)
    except FileNotFoundError as exc:
        logger.error("PPMP template missing on post: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Master PPMP template is missing; cannot store posted PPMP on Drive.",
        ) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to materialize/push posted PPMP")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to store PPMP on Drive CSE-PPMP/nonCSE-PPMP: {exc}",
        ) from exc

    drive_sync = drive_result.get("drive_sync") or {}
    if not drive_sync.get("ok"):
        raise HTTPException(
            status_code=502,
            detail=(
                "PPMP was not posted because Drive upload failed "
                f"({drive_result.get('drive_folder')}/{office.code}): "
                f"{drive_sync.get('error') or 'unknown error'}"
            ),
        )

    ppmp.posting_status = "Posted"
    ppmp.posted_at = datetime.utcnow()
    ppmp.posted_by = current_user.id
    ppmp.updated_at = datetime.utcnow()

    session.add(ppmp)
    session.commit()
    session.refresh(ppmp)

    return {
        "message": (
            f"PPMP posted to BAC and stored on Drive "
            f"{drive_result.get('drive_folder')}/"
            f"{drive_sync.get('folder') or drive_office_folder_name(office.code)}"
        ),
        "status": ppmp.status,
        "posting_status": ppmp.posting_status,
        "posted_at": ppmp.posted_at,
        "drive": drive_result,
    }


@router.post("/ppmps/{ppmp_id}/unpost")
def unpost_ppmp(
    ppmp_id: int,
    remarks: str = "",
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office"])),
):
    """
    Unpost an office PPMP from BAC consolidation and return it to the end user
    for revision (status Returned). Removes the Excel from Drive CSE-PPMP /
    nonCSE-PPMP so it is no longer picked up by file consolidation.
    """
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    if (ppmp.posting_status or "Draft") != "Posted":
        raise HTTPException(status_code=400, detail="Only Posted PPMPs can be unposted")

    office = session.get(Office, ppmp.office_id)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    drive_result = _remove_posted_ppmp_from_drive(office, ppmp)
    drive_sync = drive_result.get("drive_sync") or {}
    if not drive_sync.get("ok"):
        logger.warning(
            "Unpost Drive delete failed for PPMP %s: %s",
            ppmp_id,
            drive_sync.get("error"),
        )

    ppmp.posting_status = "Draft"
    ppmp.posted_at = None
    ppmp.posted_by = None
    ppmp.status = "Returned"
    if remarks:
        ppmp.remarks = remarks
    elif not ppmp.remarks:
        ppmp.remarks = "Unposted by Budget Office — please revise and resubmit."
    ppmp.updated_at = datetime.utcnow()

    session.add(ppmp)
    session.commit()
    session.refresh(ppmp)

    return {
        "message": "PPMP unposted, removed from Drive, and returned for end-user revision",
        "status": ppmp.status,
        "posting_status": ppmp.posting_status,
        "remarks": ppmp.remarks,
        "drive": drive_result,
    }


@router.post("/indicative/ppmps/{ppmp_id}/post")
def post_indicative_ppmp(
    ppmp_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office"])),
):
    """Post an indicative PPMP for BAC admin review."""
    ppmp = session.get(IndicativePPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="Indicative PPMP not found")
    
    # Validate that PPMP is in Draft status
    if ppmp.status != "Draft":
        raise HTTPException(status_code=400, detail="Only Draft PPMPs can be posted")
    
    # Update posting status
    ppmp.posting_status = "Posted"
    ppmp.posted_at = datetime.utcnow()
    ppmp.posted_by = current_user.id
    
    session.add(ppmp)
    session.commit()
    session.refresh(ppmp)
    
    return {
        "message": "Indicative PPMP posted successfully",
        "status": ppmp.posting_status,
        "posted_at": ppmp.posted_at
    }


@router.post("/indicative/ppmps/{ppmp_id}/unpost")
def unpost_indicative_ppmp(
    ppmp_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office"])),
):
    """Unpost an indicative PPMP (remove from BAC admin review queue)."""
    ppmp = session.get(IndicativePPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="Indicative PPMP not found")
    
    # Only allow unposting if it's in Posted status
    if ppmp.posting_status != "Posted":
        raise HTTPException(status_code=400, detail="Only Posted PPMPs can be unposted")
    
    # Reset posting status
    ppmp.posting_status = "Draft"
    ppmp.posted_at = None
    ppmp.posted_by = None
    
    session.add(ppmp)
    session.commit()
    session.refresh(ppmp)
    
    return {
        "message": "Indicative PPMP unposted successfully",
        "status": ppmp.posting_status
    }


@router.get("/ppmps/{ppmp_id}/audit")
def audit_ppmp(
    ppmp_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office", "bac_admin"])),
):
    """Get audit comparison for an office's budget vs PPMP estimated cost."""
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
        
    office = session.get(Office, ppmp.office_id)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    total_ppmp_cost = sum(item.estimated_budget for item in ppmp.items)
    
    return {
        "ppmp_id": ppmp.id,
        "ppmp_title": ppmp.title,
        "office_name": office.name,
        "office_budget_allocation": office.budget_allocation,
        "total_ppmp_cost": total_ppmp_cost,
        "is_within_budget": total_ppmp_cost <= office.budget_allocation,
        "remaining_budget": office.budget_allocation - total_ppmp_cost
    }


@router.post("/ppmps/{ppmp_id}/review")
def review_ppmp(
    ppmp_id: int,
    action: str,  # "approve" or "return"
    remarks: str = "",
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["budget_office"])),
):
    """Approve or return a PPMP."""
    ppmp = session.get(PPMP, ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    if action == "approve":
        ppmp.status = "Approved"
        # Validated but not yet posted to BAC — Budget must Post separately.
        ppmp.posting_status = "Draft"
        ppmp.posted_at = None
        ppmp.posted_by = None
        ppmp.remarks = None
    elif action == "return":
        ppmp.status = "Returned"
        ppmp.posting_status = "Draft"
        ppmp.posted_at = None
        ppmp.posted_by = None
        ppmp.remarks = remarks  # Store remarks when returning for revision
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'return'")

    ppmp.updated_at = datetime.utcnow()
    session.add(ppmp)
    session.commit()
    session.refresh(ppmp)
    return {
        "message": f"PPMP has been successfully {ppmp.status}",
        "status": ppmp.status,
        "posting_status": ppmp.posting_status,
        "remarks": remarks,
    }
