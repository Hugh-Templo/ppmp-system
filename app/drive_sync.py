import os
import subprocess
import logging
from app.config import DRIVE_SOURCE, LOCAL_INPUT_FOLDER

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
