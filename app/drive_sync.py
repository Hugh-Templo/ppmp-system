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
    drive_ppmp_rclone_source,
)

logger = logging.getLogger("drive_sync")


def _rclone_bin() -> str:
    """Return rclone executable path (bundled installer may set RCLONE_PATH)."""
    configured = (RCLONE_PATH or "rclone").strip() or "rclone"
    return configured


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
