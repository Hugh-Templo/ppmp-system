<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Services\JwtService;
use App\Models\User;
use App\Models\SystemMaintenance;

class JwtAuth
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization');

        if (!$header || !str_starts_with($header, 'Bearer ')) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $token = substr($header, 7);
        $decoded = JwtService::decodeToken($token);

        if (!$decoded || empty($decoded->sub)) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $user = User::where('username', $decoded->sub)->first();

        if (!$user || !$user->is_active) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $allowedDuringMaintenance = in_array($user->role, ['bac_admin', 'super_admin'], true);
        if (SystemMaintenance::isEnabled() && !$allowedDuringMaintenance) {
            return response()->json([
                'detail' => SystemMaintenance::bannerMessage(),
            ], 503);
        }

        // Attach user to request attributes and auth user
        $request->attributes->set('auth_user', $user);
        auth()->setUser($user);

        return $next($request);
    }
}
