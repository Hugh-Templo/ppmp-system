import logging
from celery import Celery
from app.config import REDIS_URL
from app.drive_sync import pull_inputs
from app.processing import process_csv_files, log_run

logger = logging.getLogger("celery_tasks")

celery_app = Celery("tasks", broker=REDIS_URL, backend=REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Schedule hourly sync pulls using Celery Beat
celery_app.conf.beat_schedule = {
    "sync-hourly-pull": {
        "task": "app.celery_app.sync_drive_task",
        "schedule": 3600.0,  # every hour
    },
}



@celery_app.task(name="app.celery_app.sync_drive_task")
def sync_drive_task():
    """
    Background job: pull latest CSVs from Drive, then process them.
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
