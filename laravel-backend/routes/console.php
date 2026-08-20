<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
| Hostinger / shared hosting: add a cron entry that runs every minute:
|   * * * * * cd /path/to/laravel-backend && php artisan schedule:run >> /dev/null 2>&1
|
| This drains queued notification emails without a long-running worker.
*/
Schedule::command('queue:work --stop-when-empty --tries=3 --timeout=60')
    ->everyMinute()
    ->withoutOverlapping();
