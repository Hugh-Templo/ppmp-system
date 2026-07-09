import os
from dotenv import load_dotenv

load_dotenv()

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

# Google Sheets API (Option B sync)
GOOGLE_SERVICE_ACCOUNT_FILE = os.getenv(
    "GOOGLE_SERVICE_ACCOUNT_FILE", "./credentials/google-service-account.json"
)
GOOGLE_MASTER_SPREADSHEET_ID = os.getenv("GOOGLE_MASTER_SPREADSHEET_ID", "")
GOOGLE_SYNC_FISCAL_YEAR = int(os.getenv("GOOGLE_SYNC_FISCAL_YEAR", "2027"))
