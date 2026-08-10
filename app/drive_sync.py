import os
import subprocess
import logging
from pathlib import Path
from typing import Optional

from app.config import (
    DRIVE_SOURCE,
    LOCAL_INPUT_FOLDER,
    IT_PPMPS_DIR,
    RCLONE_PATH,
    drive_app_rclone_dest,
    drive_office_folder_name,
    drive_ppmp_rclone_source,
)

logger = logging.getLogger("drive_sync")


def _rclone_bin() -> str:
    """Return rclone executable path (bundled installer may set RCLONE_PATH)."""
    configured = (RCLONE_PATH or "rclone").strip() or "rclone"
    return configured


def _rclone_run(args: list[str]) -> subprocess.CompletedProcess:
    """Run rclone; raises CalledProcessError / FileNotFoundError like subprocess.run(check=True)."""
    cmd = [_rclone_bin(), *args]
    return subprocess.run(cmd, capture_output=True, text=True, check=True)


def list_drive_office_folders(kind: str) -> dict:
    """
    List office subfolders under Drive CSE-PPMP or nonCSE-PPMP.

    Returns {ok, remote, folders, by_lower, error}.
    by_lower maps lowercase name → exact Drive folder name for reconnect.
    """
    key = (kind or "cse").strip().lower()
    if key not in ("cse", "noncse"):
        return {
            "ok": False,
            "remote": "",
            "folders": [],
            "by_lower": {},
            "error": "kind must be 'cse' or 'noncse'",
        }

    remote = drive_ppmp_rclone_source(key)
    try:
        result = _rclone_run(["lsf", remote, "--dirs-only"])
        folders: list[str] = []
        by_lower: dict[str, str] = {}
        for line in (result.stdout or "").splitlines():
            name = line.strip().rstrip("/")
            if not name:
                continue
            folders.append(name)
            by_lower.setdefault(name.lower(), name)
        return {
            "ok": True,
            "remote": remote,
            "folders": folders,
            "by_lower": by_lower,
            "error": None,
        }
    except subprocess.CalledProcessError as e:
        err = (e.stderr or e.stdout or str(e)).strip()
        logger.error("rclone lsf failed for %s: %s", key, err)
        return {
            "ok": False,
            "remote": remote,
            "folders": [],
            "by_lower": {},
            "error": err or "rclone lsf failed",
        }
    except FileNotFoundError:
        err = "rclone executable not found. Install rclone and ensure it is on PATH."
        logger.error(err)
        return {
            "ok": False,
            "remote": remote,
            "folders": [],
            "by_lower": {},
            "error": err,
        }


def _ensure_one_kind_office_folder(kind: str, short_name: str) -> dict:
    """Ensure CSE-PPMP/{short} or nonCSE-PPMP/{short} exists; reuse case-insensitive match."""
    key = (kind or "cse").strip().lower()
    remote_root = drive_ppmp_rclone_source(key)
    listing = list_drive_office_folders(key)
    if not listing.get("ok"):
        return {
            "ok": False,
            "kind": key,
            "folder": short_name,
            "remote": f"{remote_root}/{short_name}",
            "created": False,
            "reused": False,
            "error": listing.get("error") or "failed to list Drive folders",
        }

    existing = (listing.get("by_lower") or {}).get(short_name.lower())
    if existing:
        return {
            "ok": True,
            "kind": key,
            "folder": existing,
            "remote": f"{remote_root}/{existing}",
            "created": False,
            "reused": True,
            "error": None,
        }

    remote_folder = f"{remote_root}/{short_name}"
    try:
        _rclone_run(["mkdir", remote_folder])
        logger.info("Created Drive office folder: %s", remote_folder)
        return {
            "ok": True,
            "kind": key,
            "folder": short_name,
            "remote": remote_folder,
            "created": True,
            "reused": False,
            "error": None,
        }
    except subprocess.CalledProcessError as e:
        err = (e.stderr or e.stdout or str(e)).strip()
        # Race / already exists — treat as reuse if list now finds it.
        relist = list_drive_office_folders(key)
        found = (relist.get("by_lower") or {}).get(short_name.lower()) if relist.get("ok") else None
        if found:
            return {
                "ok": True,
                "kind": key,
                "folder": found,
                "remote": f"{remote_root}/{found}",
                "created": False,
                "reused": True,
                "error": None,
            }
        logger.error("rclone mkdir failed for %s: %s", remote_folder, err)
        return {
            "ok": False,
            "kind": key,
            "folder": short_name,
            "remote": remote_folder,
            "created": False,
            "reused": False,
            "error": err or "rclone mkdir failed",
        }
    except FileNotFoundError:
        err = "rclone executable not found. Install rclone and ensure it is on PATH."
        logger.error(err)
        return {
            "ok": False,
            "kind": key,
            "folder": short_name,
            "remote": remote_folder,
            "created": False,
            "reused": False,
            "error": err,
        }


def ensure_office_drive_folders(office_code: str) -> dict:
    """
    Ensure CSE-PPMP/{short} and nonCSE-PPMP/{short} exist on Drive (reuse if present).
    Also creates matching local IT_ppmps/{CSE|nonCSE}/{short} directories.

    Soft-deleted offices keep Drive folders; recreating reconnects via case-insensitive match.
    """
    from app.file_ppmps import KIND_FOLDER, ensure_it_ppmps_dirs

    short = drive_office_folder_name(office_code)
    ensure_it_ppmps_dirs()
    local_paths = {}
    for key, kind_name in KIND_FOLDER.items():
        local = IT_PPMPS_DIR / kind_name / short
        local.mkdir(parents=True, exist_ok=True)
        local_paths[key] = str(local)

    kinds = {
        "cse": _ensure_one_kind_office_folder("cse", short),
        "noncse": _ensure_one_kind_office_folder("noncse", short),
    }
    ok = all(bool(v.get("ok")) for v in kinds.values())
    any_created = any(bool(v.get("created")) for v in kinds.values())
    any_reused = any(bool(v.get("reused")) for v in kinds.values())
    errors = [v.get("error") for v in kinds.values() if v.get("error")]
    return {
        "ok": ok,
        "folder": short,
        "created": any_created,
        "reused": any_reused and not any_created,
        "kinds": kinds,
        "local": local_paths,
        "error": "; ".join(errors) if errors else None,
    }


def push_ppmp_to_drive(
    local_path: str | Path,
    kind: str,
    office_code: str,
) -> dict:
    """
    Upload one PPMP Excel into Drive CSE-PPMP/{office}/ or nonCSE-PPMP/{office}/.
    Ensures the office folder exists first (creates or reconnects). Does not delete Drive files.
    """
    path = Path(local_path)
    key = (kind or "cse").strip().lower()
    short = drive_office_folder_name(office_code)
    if key not in ("cse", "noncse"):
        return {
            "ok": False,
            "remote": "",
            "folder": short,
            "error": "kind must be 'cse' or 'noncse'",
        }
    if not path.is_file():
        return {
            "ok": False,
            "remote": "",
            "folder": short,
            "error": f"Local file missing: {path}",
        }

    ensure_one = _ensure_one_kind_office_folder(key, short)
    if not ensure_one.get("ok"):
        return {
            "ok": False,
            "remote": ensure_one.get("remote") or "",
            "folder": ensure_one.get("folder") or short,
            "error": ensure_one.get("error") or "failed to ensure Drive office folder",
        }

    remote_folder = ensure_one["remote"]
    try:
        _rclone_run(["copy", str(path), remote_folder])
        logger.info("Uploaded PPMP %s -> %s", path.name, remote_folder)
        return {
            "ok": True,
            "remote": remote_folder,
            "folder": ensure_one.get("folder") or short,
            "filename": path.name,
            "reused_folder": bool(ensure_one.get("reused")),
            "error": None,
        }
    except subprocess.CalledProcessError as e:
        err = (e.stderr or e.stdout or str(e)).strip()
        logger.error("rclone copy PPMP failed: %s", err)
        return {
            "ok": False,
            "remote": remote_folder,
            "folder": ensure_one.get("folder") or short,
            "filename": path.name,
            "error": err or "rclone copy failed",
        }
    except FileNotFoundError:
        err = "rclone executable not found. Install rclone and ensure it is on PATH."
        logger.error(err)
        return {
            "ok": False,
            "remote": remote_folder,
            "folder": ensure_one.get("folder") or short,
            "filename": path.name,
            "error": err,
        }


def delete_ppmp_from_drive(
    filename: str,
    kind: str,
    office_code: str,
) -> dict:
    """
    Delete one PPMP Excel from Drive CSE-PPMP/{office}/ or nonCSE-PPMP/{office}/.
    Used when Budget unposts a plan so BAC consolidate-from-files no longer sees it.
    """
    key = (kind or "cse").strip().lower()
    short = drive_office_folder_name(office_code)
    name = (filename or "").strip()
    if key not in ("cse", "noncse"):
        return {
            "ok": False,
            "remote": "",
            "folder": short,
            "filename": name,
            "error": "kind must be 'cse' or 'noncse'",
        }
    if not name or "/" in name or "\\" in name:
        return {
            "ok": False,
            "remote": "",
            "folder": short,
            "filename": name,
            "error": "invalid filename",
        }

    ensure_one = _ensure_one_kind_office_folder(key, short)
    if not ensure_one.get("ok"):
        return {
            "ok": False,
            "remote": ensure_one.get("remote") or "",
            "folder": ensure_one.get("folder") or short,
            "filename": name,
            "error": ensure_one.get("error") or "failed to ensure Drive office folder",
        }

    remote_file = f"{ensure_one['remote'].rstrip('/')}/{name}"
    try:
        _rclone_run(["deletefile", remote_file])
        logger.info("Deleted Drive PPMP %s", remote_file)
        return {
            "ok": True,
            "remote": remote_file,
            "folder": ensure_one.get("folder") or short,
            "filename": name,
            "error": None,
        }
    except subprocess.CalledProcessError as e:
        err = (e.stderr or e.stdout or str(e)).strip()
        # Missing remote file is fine on unpost (already gone / never uploaded).
        low = err.lower()
        if "not found" in low or "directory not found" in low or "object not found" in low:
            logger.info("Drive PPMP already absent: %s (%s)", remote_file, err)
            return {
                "ok": True,
                "remote": remote_file,
                "folder": ensure_one.get("folder") or short,
                "filename": name,
                "error": None,
                "missing": True,
            }
        logger.error("rclone deletefile PPMP failed: %s", err)
        return {
            "ok": False,
            "remote": remote_file,
            "folder": ensure_one.get("folder") or short,
            "filename": name,
            "error": err or "rclone deletefile failed",
        }
    except FileNotFoundError:
        err = "rclone executable not found. Install rclone and ensure it is on PATH."
        logger.error(err)
        return {
            "ok": False,
            "remote": remote_file,
            "folder": ensure_one.get("folder") or short,
            "filename": name,
            "error": err,
        }


def pull_inputs() -> bool:
    """
    Runs rclone sync to fetch the CSV files from Google Drive folder locally.
    """
    logger.info(f"Syncing from {DRIVE_SOURCE} to {LOCAL_INPUT_FOLDER}")

    # Ensure local directory exists
    os.makedirs(LOCAL_INPUT_FOLDER, exist_ok=True)

    # Run the rclone sync command
    # e.g., rclone sync gdrive:inputs ./data/inputs
    cmd = [_rclone_bin(), "sync", DRIVE_SOURCE, LOCAL_INPUT_FOLDER]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        logger.info("rclone sync completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"rclone sync failed with exit code {e.returncode}")
        logger.error(f"rclone stderr: {e.stderr}")
        return False
    except FileNotFoundError:
        logger.error(
            "rclone executable not found. Make sure rclone is installed and in your PATH."
        )
        return False


def push_app_to_drive(local_path: str | Path, kind: str) -> dict:
    """
    Upload a consolidated APP workbook to Drive CSE-APP or nonCSE-APP.

    Returns {ok, remote, error}.
    """
    path = Path(local_path)
    remote = drive_app_rclone_dest(kind)
    if not path.is_file():
        return {"ok": False, "remote": remote, "error": f"Local file missing: {path}"}

    cmd = [_rclone_bin(), "copy", str(path), remote, "--create-empty-src-dirs"]
    logger.info("Uploading %s -> %s", path, remote)
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        logger.info("rclone upload completed: %s", path.name)
        return {"ok": True, "remote": remote, "error": None, "filename": path.name}
    except subprocess.CalledProcessError as e:
        err = (e.stderr or e.stdout or str(e)).strip()
        logger.error("rclone upload failed: %s", err)
        return {"ok": False, "remote": remote, "error": err or "rclone copy failed"}
    except FileNotFoundError:
        err = "rclone executable not found. Install rclone and ensure it is on PATH."
        logger.error(err)
        return {"ok": False, "remote": remote, "error": err}


def _sync_one_ppmp_kind(kind: str) -> dict:
    """rclone sync one Drive PPMP tree (office subfolders) into local IT_ppmps/{CSE|nonCSE}."""
    from app.file_ppmps import ensure_it_ppmps_dirs

    key = (kind or "cse").strip().lower()
    if key not in ("cse", "noncse"):
        return {
            "ok": False,
            "remote": "",
            "local": "",
            "error": "kind must be 'cse' or 'noncse'",
        }

    folders = ensure_it_ppmps_dirs()
    local = Path(folders[key])
    remote = drive_ppmp_rclone_source(key)
    local.mkdir(parents=True, exist_ok=True)

    cmd = [_rclone_bin(), "sync", remote, str(local)]
    logger.info("Syncing PPMPs %s -> %s", remote, local)
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        logger.info("PPMP sync completed for %s", key)
        return {
            "ok": True,
            "remote": remote,
            "local": str(local),
            "error": None,
        }
    except subprocess.CalledProcessError as e:
        err = (e.stderr or e.stdout or str(e)).strip()
        logger.error("PPMP sync failed for %s: %s", key, err)
        return {
            "ok": False,
            "remote": remote,
            "local": str(local),
            "error": err or "rclone sync failed",
        }
    except FileNotFoundError:
        err = "rclone executable not found. Install rclone and ensure it is on PATH."
        logger.error(err)
        return {
            "ok": False,
            "remote": remote,
            "local": str(local),
            "error": err,
        }


def pull_ppmps_from_drive(kind: Optional[str] = None) -> dict:
    """
    Pull office PPMP Excel files from Drive into IT_ppmps.

    Drive layout: CSE-PPMP/{office}/… and nonCSE-PPMP/{office}/…
    Local mirror: IT_ppmps/CSE/{office}/… and IT_ppmps/nonCSE/{office}/…

    kind=cse|noncse syncs one side; omit / None syncs both.
    """
    kind_norm = (kind or "").strip().lower() or None
    if kind_norm is not None and kind_norm not in ("cse", "noncse"):
        return {
            "ok": False,
            "kinds": {},
            "error": "kind must be 'cse' or 'noncse'",
        }

    targets = [kind_norm] if kind_norm else ["cse", "noncse"]
    kinds: dict = {}
    for k in targets:
        kinds[k] = _sync_one_ppmp_kind(k)

    ok = all(bool(v.get("ok")) for v in kinds.values()) if kinds else False
    return {"ok": ok, "kinds": kinds, "root": str(IT_PPMPS_DIR)}
