import os
import glob
import pandas as pd
import json
import logging
from datetime import datetime
from sqlmodel import Session
from app.config import LOCAL_INPUT_FOLDER
from app.database import engine
from app.models import ProcessedRow, SyncLog

logger = logging.getLogger("processing")


def log_run(success: bool, files_processed: int, message: str = None):
    """Logs the pipeline run status in the database."""
    with Session(engine) as session:
        log = SyncLog(
            ran_at=datetime.utcnow(),
            success=success,
            files_processed=files_processed,
            message=message,
        )
        session.add(log)
        session.commit()


def process_csv_files() -> int:
    """
    Finds all CSV files in LOCAL_INPUT_FOLDER, processes them with pandas,
    and inserts each row into the ProcessedRow database table as JSON.
    """
    if not os.path.exists(LOCAL_INPUT_FOLDER):
        logger.warning(f"Local input folder {LOCAL_INPUT_FOLDER} does not exist.")
        return 0

    csv_files = glob.glob(os.path.join(LOCAL_INPUT_FOLDER, "*.csv"))
    if not csv_files:
        logger.info("No CSV files found to process.")
        return 0

    processed_count = 0
    with Session(engine) as session:
        for file_path in csv_files:
            filename = os.path.basename(file_path)
            logger.info(f"Processing CSV file: {filename}")

            try:
                # Read CSV
                df = pd.read_csv(file_path)

                # Insert each row as JSON string
                for _, row in df.iterrows():
                    # Convert pandas row to dictionary and serialize to JSON
                    row_dict = row.to_dict()
                    # Clean up nan values or pandas-specific types to avoid JSON serialization errors
                    cleaned_row = {
                        k: (None if pd.isna(v) else v) for k, v in row_dict.items()
                    }

                    db_row = ProcessedRow(
                        source_file=filename,
                        row_data=json.dumps(cleaned_row),
                        imported_at=datetime.utcnow(),
                    )
                    session.add(db_row)

                # Delete/archive the file after successful processing to avoid processing it again
                os.remove(file_path)
                logger.info(
                    f"Successfully processed and deleted local file: {filename}"
                )
                processed_count += 1

            except Exception as e:
                logger.error(f"Error processing file {filename}: {str(e)}")
                session.rollback()
                raise e

        session.commit()

    return processed_count
