import os
import re
from pathlib import Path
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
# Prefer install-root .env (Windows service / packaged deploy)
load_dotenv(REPO_ROOT / ".env")
load_dotenv()

RCLONE_REMOTE = os.getenv("RCLONE_REMOTE", "gdrive")
# Absolute path to rclone.exe when not on PATH (Windows installer bundles tools/rclone)
RCLONE_PATH = os.getenv("RCLONE_PATH", "rclone")
DRIVE_INPUT_FOLDER = os.getenv("DRIVE_INPUT_FOLDER", "inputs")
LOCAL_INPUT_FOLDER = os.getenv("LOCAL_INPUT_FOLDER", "./data/inputs")
SYNC_INTERVAL_MINUTES = int(os.getenv("SYNC_INTERVAL_MINUTES", "60"))
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ppmpbacdb")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

SECRET_KEY = os.getenv("SECRET_KEY", "8df5e8c4601be24e772f778a48ef0406d4e5f2e825a0756788db9f18a28723c0")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Full rclone source path, e.g. "gdrive:inputs"
DRIVE_SOURCE = f"{RCLONE_REMOTE}:{DRIVE_INPUT_FOLDER}"

# Local office PPMP Excel sources for file-based CSE/nonCSE consolidation
IT_PPMPS_DIR = Path(
    os.getenv("IT_PPMPS_DIR", str(REPO_ROOT / "IT_ppmps"))
).resolve()
LOCAL_APP_OUTPUT_FOLDER = Path(
    os.getenv("LOCAL_APP_OUTPUT_FOLDER", str(REPO_ROOT / "data" / "app_outputs"))
).resolve()

# Google Drive APP SYSTEM FILES
# Root: https://drive.google.com/drive/folders/1WwsC0Le5uo71jSzZlYsEnQT5MGWTnjq6
DRIVE_APP_ROOT_FOLDER_ID = os.getenv(
    "DRIVE_APP_ROOT_FOLDER_ID", "1WwsC0Le5uo71jSzZlYsEnQT5MGWTnjq6"
)
# Consolidated APP upload targets
DRIVE_CSE_APP_SUBFOLDER = os.getenv("DRIVE_CSE_APP_SUBFOLDER", "CSE-APP")
DRIVE_NONCSE_APP_SUBFOLDER = os.getenv("DRIVE_NONCSE_APP_SUBFOLDER", "nonCSE-APP")
# Office PPMP source folders (Drive → local IT_ppmps)
# Layout: CSE-PPMP/{office}/… and nonCSE-PPMP/{office}/… (e.g. BAC, ADMIN, IT)
DRIVE_CSE_PPMP_SUBFOLDER = os.getenv("DRIVE_CSE_PPMP_SUBFOLDER", "CSE-PPMP")
DRIVE_NONCSE_PPMP_SUBFOLDER = os.getenv("DRIVE_NONCSE_PPMP_SUBFOLDER", "nonCSE-PPMP")


def drive_app_rclone_dest(kind: str) -> str:
    """rclone destination for consolidated APP uploads (folder-id root)."""
    sub = (
        DRIVE_CSE_APP_SUBFOLDER
        if (kind or "").strip().lower() == "cse"
        else DRIVE_NONCSE_APP_SUBFOLDER
    )
    return f"{RCLONE_REMOTE},root_folder_id={DRIVE_APP_ROOT_FOLDER_ID}:{sub}"


def drive_ppmp_rclone_source(kind: str) -> str:
    """rclone source for office PPMP Excel files under Drive CSE-PPMP/{office} or nonCSE-PPMP/{office}."""
    sub = (
        DRIVE_CSE_PPMP_SUBFOLDER
        if (kind or "").strip().lower() == "cse"
        else DRIVE_NONCSE_PPMP_SUBFOLDER
    )
    return f"{RCLONE_REMOTE},root_folder_id={DRIVE_APP_ROOT_FOLDER_ID}:{sub}"


def drive_office_folder_name(code: str) -> str:
    """
    Short Drive/local office folder from office.code.

    Strips a leading O- / O_ (case-insensitive). Examples:
    O-BAC → BAC, O-CHO → CHO, IT → IT.
    """
    text = (code or "").strip()
    if not text:
        return "office"
    cleaned = re.sub(r"(?i)^O[-_]", "", text).strip()
    cleaned = re.sub(r"[^\w\-]+", "_", cleaned).strip("_") or "office"
    return cleaned


# Google Sheets API (Option B sync)
GOOGLE_SERVICE_ACCOUNT_FILE = os.getenv(
    "GOOGLE_SERVICE_ACCOUNT_FILE", "./credentials/google-service-account.json"
)
GOOGLE_MASTER_SPREADSHEET_ID = os.getenv("GOOGLE_MASTER_SPREADSHEET_ID", "")
GOOGLE_SYNC_FISCAL_YEAR = int(os.getenv("GOOGLE_SYNC_FISCAL_YEAR", "2027"))
