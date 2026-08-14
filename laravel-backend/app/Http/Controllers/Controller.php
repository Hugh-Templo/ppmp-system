<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

abstract class Controller
{
    protected function authUser(Request $request): User
    {
        $user = $request->attributes->get('auth_user');
        if ($user instanceof User) {
            return $user;
        }

        $fallback = $request->user();
        if ($fallback instanceof User) {
            return $fallback;
        }

        abort(401, 'Could not validate credentials');
    }
}
