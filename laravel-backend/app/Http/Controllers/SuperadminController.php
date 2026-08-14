<?php

namespace App\Http\Controllers;

use App\Models\Office;
use App\Models\Ppmp;
use App\Models\SystemActivityLog;
use App\Models\SystemLoginLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class SuperadminController extends Controller
{
    public function overview()
    {
        $since = now()->subDay();

        $usersByRole = User::query()
            ->select('role', DB::raw('COUNT(*) as total'), DB::raw('SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active'))
            ->groupBy('role')
            ->get()
            ->mapWithKeys(fn ($row) => [
                $row->role => [
                    'total' => (int) $row->total,
                    'active' => (int) $row->active,
                ],
            ]);

        $ppmpByStatus = Ppmp::query()
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->map(fn ($n) => (int) $n);

        return response()->json([
            'generated_at' => now()->toIso8601String(),
            'counts' => [
                'users_total' => User::count(),
                'users_active' => User::where('is_active', true)->count(),
                'users_by_role' => $usersByRole,
                'offices_active' => Office::where('is_active', true)->count(),
                'offices_total' => Office::count(),
                'ppmps_by_status' => $ppmpByStatus,
                'logins_24h' => SystemLoginLog::where('created_at', '>=', $since)->count(),
                'logins_failed_24h' => SystemLoginLog::where('created_at', '>=', $since)->where('success', false)->count(),
                'api_hits_24h' => SystemActivityLog::where('created_at', '>=', $since)->count(),
            ],
            'failed_logins' => SystemLoginLog::query()
                ->where('success', false)
                ->orderByDesc('id')
                ->limit(20)
                ->get([
                    'id', 'user_id', 'username', 'ip_address', 'user_agent', 'success', 'created_at',
                ]),
        ]);
    }

    public function activity(Request $request)
    {
        $limit = min(200, max(1, (int) $request->query('limit', 50)));

        $rows = SystemActivityLog::query()
            ->orderByDesc('id')
            ->limit($limit)
            ->get([
                'id', 'user_id', 'username', 'method', 'path', 'status_code',
                'ip_address', 'duration_ms', 'created_at',
            ]);

        return response()->json(['items' => $rows]);
    }

    public function logins(Request $request)
    {
        $limit = min(200, max(1, (int) $request->query('limit', 50)));

        $rows = SystemLoginLog::query()
            ->orderByDesc('id')
            ->limit($limit)
            ->get([
                'id', 'user_id', 'username', 'ip_address', 'user_agent', 'success', 'created_at',
            ]);

        return response()->json(['items' => $rows]);
    }

    public function errors()
    {
        $path = storage_path('logs/laravel.log');
        if (!is_file($path) || !is_readable($path)) {
            return response()->json([
                'source' => $path,
                'lines' => [],
                'message' => 'Log file not found or unreadable',
            ]);
        }

        try {
            $raw = @file($path, FILE_IGNORE_NEW_LINES);
            if ($raw === false) {
                return response()->json([
                    'source' => $path,
                    'lines' => [],
                    'message' => 'Unable to read log file',
                ]);
            }

            $errorish = array_values(array_filter($raw, function ($line) {
                return (bool) preg_match('/\.(ERROR|CRITICAL|ALERT|EMERGENCY):|local\.(ERROR|CRITICAL)/i', $line);
            }));

            $lines = array_slice($errorish, -40);

            return response()->json([
                'source' => 'storage/logs/laravel.log',
                'lines' => $lines,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'source' => $path,
                'lines' => [],
                'message' => 'Failed to parse log file',
            ], 500);
        }
    }
}
