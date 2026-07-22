import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parent.parent

RCLONE_REMOTE = os.getenv("RCLONE_REMOTE", "gdrive")
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

# Google Drive APP SYSTEM FILES (CSE-APP / nonCSE-APP upload targets)
DRIVE_APP_ROOT_FOLDER_ID = os.getenv(
    "DRIVE_APP_ROOT_FOLDER_ID", "1WwsC0Le5uo71jSzZlYsEnQT5MGWTnjq6"
)
DRIVE_CSE_APP_SUBFOLDER = os.getenv("DRIVE_CSE_APP_SUBFOLDER", "CSE-APP")
DRIVE_NONCSE_APP_SUBFOLDER = os.getenv("DRIVE_NONCSE_APP_SUBFOLDER", "nonCSE-APP")


def drive_app_rclone_dest(kind: str) -> str:
    """rclone destination for consolidated APP uploads (folder-id root)."""
    sub = (
        DRIVE_CSE_APP_SUBFOLDER
        if (kind or "").strip().lower() == "cse"
        else DRIVE_NONCSE_APP_SUBFOLDER
    )
    return f"{RCLONE_REMOTE},root_folder_id={DRIVE_APP_ROOT_FOLDER_ID}:{sub}"


# Google Sheets API (Option B sync)
GOOGLE_SERVICE_ACCOUNT_FILE = os.getenv(
    "GOOGLE_SERVICE_ACCOUNT_FILE", "./credentials/google-service-account.json"
)
GOOGLE_MASTER_SPREADSHEET_ID = os.getenv("GOOGLE_MASTER_SPREADSHEET_ID", "")
GOOGLE_SYNC_FISCAL_YEAR = int(os.getenv("GOOGLE_SYNC_FISCAL_YEAR", "2027"))
