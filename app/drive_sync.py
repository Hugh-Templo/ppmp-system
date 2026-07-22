import os
import subprocess
import logging
from pathlib import Path

from app.config import (
    DRIVE_SOURCE,
    LOCAL_INPUT_FOLDER,
    drive_app_rclone_dest,
)

logger = logging.getLogger("drive_sync")


def pull_inputs() -> bool:
    """
    Runs rclone sync to fetch the CSV files from Google Drive folder locally.
    """
    logger.info(f"Syncing from {DRIVE_SOURCE} to {LOCAL_INPUT_FOLDER}")

    # Ensure local directory exists
    os.makedirs(LOCAL_INPUT_FOLDER, exist_ok=True)

    # Run the rclone sync command
    # e.g., rclone sync gdrive:inputs ./data/inputs
    cmd = ["rclone", "sync", DRIVE_SOURCE, LOCAL_INPUT_FOLDER]

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

    cmd = ["rclone", "copy", str(path), remote, "--create-empty-src-dirs"]
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
