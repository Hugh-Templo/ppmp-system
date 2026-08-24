<?php

require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use App\Models\Ppmp;
use App\Services\JwtService;

function hit(string $token, string $path): void
{
    $url = 'http://127.0.0.1:8000' . $path;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
        ],
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $parts = explode("\r\n\r\n", (string) $raw, 2);
    $body = $parts[1] ?? $raw;
    echo "GET {$path} => HTTP {$code} curl={$err} body_len=" . strlen((string) $body) . PHP_EOL;
    echo substr((string) $body, 0, 800) . PHP_EOL . PHP_EOL;
}

$obo = User::where('username', 'OBO')->first();
$csu = User::where('username', 'CSU')->first();
$budget = User::where('role', 'budget_office')->first();
$admin = User::where('role', 'bac_admin')->first();

foreach ([$obo, $csu, $budget, $admin] as $user) {
    if (!$user) {
        continue;
    }
    echo "==== {$user->username} role={$user->role} office={$user->office_id} ====" . PHP_EOL;
    $token = JwtService::createToken(['sub' => $user->username], 10);
    foreach (Ppmp::where('status', 'Returned')->get() as $ppmp) {
        hit($token, "/api/offices/ppmps/{$ppmp->id}");
    }
}
