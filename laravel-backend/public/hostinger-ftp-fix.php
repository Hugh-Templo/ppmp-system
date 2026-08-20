<?php
/**
 * One-time Hostinger fixer for FTP-only access.
 *
 * 1. Upload this file next to Laravel index.php (public_html or laravel-backend/public).
 * 2. Open: https://YOUR-SITE/hostinger-ftp-fix.php?key=PPMPFIX2026
 * 3. DELETE this file in FileZilla immediately after it succeeds.
 */
$key = 'PPMPFIX2026';
if (!hash_equals($key, (string) ($_GET['key'] ?? ''))) {
    http_response_code(404);
    echo 'Not found';
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

$candidates = [
    dirname(__DIR__),
    __DIR__,
    dirname(__DIR__, 2),
];

$base = null;
foreach ($candidates as $dir) {
    if (is_file($dir . DIRECTORY_SEPARATOR . 'artisan')
        && is_file($dir . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php')) {
        $base = $dir;
        break;
    }
}

if ($base === null) {
    echo "Could not find Laravel artisan.\n";
    echo "Upload this file into the same folder as index.php (Laravel public).\n";
    exit(1);
}

echo "Laravel root: {$base}\n\n";

$dirs = [
    $base . '/storage/app/public',
    $base . '/storage/framework/cache/data',
    $base . '/storage/framework/sessions',
    $base . '/storage/framework/views',
    $base . '/storage/logs',
    $base . '/bootstrap/cache',
];

foreach ($dirs as $dir) {
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        echo "FAIL mkdir {$dir}\n";
    } else {
        echo "OK dir {$dir}\n";
    }
    @chmod($dir, 0775);
}

$log = $base . '/storage/logs/laravel.log';
if (!is_file($log)) {
    file_put_contents($log, '');
}
@chmod($log, 0664);
echo is_writable($base . '/storage') ? "OK storage writable\n" : "FAIL storage not writable\n";
echo is_writable($base . '/bootstrap/cache') ? "OK bootstrap/cache writable\n" : "FAIL bootstrap/cache not writable\n";

$clear = [
    $base . '/bootstrap/cache/config.php',
    $base . '/bootstrap/cache/routes-v7.php',
    $base . '/bootstrap/cache/routes.php',
    $base . '/bootstrap/cache/events.php',
];
foreach ($clear as $file) {
    if (is_file($file)) {
        echo (unlink($file) ? "Deleted " : "FAIL delete ") . basename($file) . "\n";
    }
}

$autoload = $base . '/vendor/autoload.php';
if (!is_file($autoload)) {
    echo "\nFAIL: vendor/autoload.php missing. Run composer install on your PC, then upload the vendor folder with FileZilla.\n";
    exit(1);
}

require $autoload;
$app = require $base . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$commands = [
    'config:clear',
    'cache:clear',
    'route:clear',
    'view:clear',
];

echo "\n--- artisan ---\n";
foreach ($commands as $command) {
    try {
        Illuminate\Support\Facades\Artisan::call($command);
        echo "OK {$command}\n";
    } catch (Throwable $e) {
        echo "FAIL {$command}: " . $e->getMessage() . "\n";
    }
}

try {
    Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
    echo "OK migrate --force\n";
    echo Illuminate\Support\Facades\Artisan::output();
} catch (Throwable $e) {
    echo "FAIL migrate: " . $e->getMessage() . "\n";
}

try {
    Illuminate\Support\Facades\DB::select('select 1');
    echo "\nOK database connected\n";
} catch (Throwable $e) {
    echo "\nFAIL database: " . $e->getMessage() . "\n";
}

echo "\nDELETE this file in FileZilla now: hostinger-ftp-fix.php\n";
