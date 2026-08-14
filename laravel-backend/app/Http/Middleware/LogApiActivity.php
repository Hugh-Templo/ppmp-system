<?php

namespace App\Http\Middleware;

use App\Models\SystemActivityLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class LogApiActivity
{
    /**
     * Log authenticated API requests for superadmin monitoring.
     * Skips bodies/passwords and high-noise monitor/health endpoints.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $started = microtime(true);
        $response = $next($request);

        try {
            $path = '/' . ltrim($request->path(), '/');

            if (
                $request->is('api/health')
                || $request->is('up')
                || $request->is('api/superadmin')
                || $request->is('api/superadmin/*')
            ) {
                return $response;
            }

            $user = $request->attributes->get('auth_user') ?? $request->user();
            if (!$user) {
                return $response;
            }

            $durationMs = (int) round((microtime(true) - $started) * 1000);

            SystemActivityLog::create([
                'user_id' => $user->id ?? null,
                'username' => $user->username ?? null,
                'method' => strtoupper($request->method()),
                'path' => mb_substr($path, 0, 500),
                'status_code' => $response->getStatusCode(),
                'ip_address' => $request->ip(),
                'duration_ms' => $durationMs,
                'created_at' => now(),
            ]);
        } catch (Throwable $e) {
            // Never break the response for logging failures.
        }

        return $response;
    }
}
