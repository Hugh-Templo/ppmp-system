<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Google Drive (legacy / optional)
    |--------------------------------------------------------------------------
    |
    | Personal Gmail cannot upload files via a service account (0 quota).
    | Preferred workflow: BAC Admin → Download for rclone → scripts/rclone on a PC.
    |
    | These settings are unused by the rclone package download path.
    |
    */
    'service_account_file' => env('GOOGLE_SERVICE_ACCOUNT_FILE', ''),
    'drive_root_folder_id' => env('GOOGLE_DRIVE_ROOT_FOLDER_ID', ''),
    'drive_impersonate_user' => env('GOOGLE_DRIVE_IMPERSONATE_USER', ''),
];
