import logging
from app.celery_app import sync_drive_task

logger = logging.getLogger("scheduler")


def run_pipeline():
    """
    Triggers the Celery background task asynchronously.
    """
    logger.info("Triggering background Celery task for pipeline run")
    task = sync_drive_task.delay()
    return task.id


def start_scheduler():
    """
    Placeholder/No-op: Scheduling is handled by Celery Beat.
    """
    logger.info(
        "Scheduler startup: Background scheduling is handled by Celery Beat."
    )
