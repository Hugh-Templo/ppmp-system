<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Google service account JSON key
    |--------------------------------------------------------------------------
    |
    | Absolute path, or path relative to the Laravel base path / project root.
    | Example: ../credentials/google-service-account.json
    |
    */
    'service_account_file' => env('GOOGLE_SERVICE_ACCOUNT_FILE', ''),

    /*
    |--------------------------------------------------------------------------
    | Drive root folder ID for "APP SYSTEM FILES"
    |--------------------------------------------------------------------------
    |
    | Share this folder with the service account as Editor. Uploads go under
    | APP SYSTEM FILES/{fy}/CSE-PPMP|nonCSE-PPMP|CSE-APP|nonCSE-APP/...
    |
    */
    'drive_root_folder_id' => env('GOOGLE_DRIVE_ROOT_FOLDER_ID', ''),
];
