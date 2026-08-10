<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$roles
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->attributes->get('auth_user') ?: auth()->user();

        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        if (!in_array($user->role, $roles)) {
            return response()->json(['detail' => 'You do not have permission to access this resource'], 403);
        }

        return $next($request);
    }
}
