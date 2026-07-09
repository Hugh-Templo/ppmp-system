import logging
from celery import Celery
from app.config import REDIS_URL, GOOGLE_MASTER_SPREADSHEET_ID
from app.drive_sync import pull_inputs
from app.processing import process_csv_files, log_run
from app.sheets_sync import sync_from_sheets

logger = logging.getLogger("celery_tasks")

celery_app = Celery("tasks", broker=REDIS_URL, backend=REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    "sync-hourly-sheets": {
        "task": "app.celery_app.sync_sheets_task",
        "schedule": 3600.0,
    },
}


@celery_app.task(name="app.celery_app.sync_sheets_task")
def sync_sheets_task():
    """Background job: sync indicative PPMPs from Google Sheets (Option B)."""
    logger.info("Celery background task: Starting Google Sheets sync")
    if not GOOGLE_MASTER_SPREADSHEET_ID:
        logger.warning("GOOGLE_MASTER_SPREADSHEET_ID not set, skipping sheets sync")
        return "Skipped: GOOGLE_MASTER_SPREADSHEET_ID not configured"

    try:
        count, message = sync_from_sheets()
        log_run(success=True, files_processed=count, message=message)
        logger.info("Sheets sync complete: %s", message)
        return message
    except Exception as e:
        log_run(success=False, files_processed=0, message=f"Sheets sync failed: {str(e)}")
        logger.error("Sheets sync error: %s", str(e))
        return f"Error: {str(e)}"


@celery_app.task(name="app.celery_app.sync_drive_task")
def sync_drive_task():
    """
    Legacy background job: pull CSVs from Drive via rclone, then process them.
    Kept as fallback; primary sync is sync_sheets_task (Option B).
    """
    logger.info("Celery background task: Starting drive sync pipeline")
    success = pull_inputs()

    if not success:
        log_run(success=False, files_processed=0, message="rclone sync failed")
        return "rclone sync failed"

    try:
        files_processed = process_csv_files()
        log_run(success=True, files_processed=files_processed, message="OK")
        logger.info(
            f"Celery background task complete: {files_processed} file(s) processed"
        )
        return f"OK: {files_processed} files processed"
    except Exception as e:
        log_run(
            success=False, files_processed=0, message=f"Processing failed: {str(e)}"
        )
        logger.error(f"Celery background task error: {str(e)}")
        return f"Error: {str(e)}"
