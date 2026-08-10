<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Office;
use App\Services\JwtService;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $username = $request->input('username');
        $password = $request->input('password');

        if (!$username || !$password) {
            return response()->json(['detail' => 'Incorrect username or password'], 401);
        }

        $user = User::where('username', $username)->first();

        if (!$user || !Hash::check($password, $user->hashed_password)) {
            return response()->json(['detail' => 'Incorrect username or password'], 401);
        }

        $token = JwtService::createToken(['sub' => $user->username]);

        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
        ]);
    }

    public function getMe(Request $request)
    {
        $user = $request->attributes->get('auth_user') ?: auth()->user();

        return response()->json([
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'role' => $user->role,
            'office_id' => $user->office_id,
            'is_active' => (bool)$user->is_active,
            'created_at' => $user->created_at,
        ]);
    }

    public function register(Request $request)
    {
        $currentUser = $request->attributes->get('auth_user') ?: auth()->user();
        if ($currentUser->role !== 'bac_admin') {
            return response()->json(['detail' => 'Access denied: Only BAC administrators can register users'], 403);
        }

        $username = trim($request->input('username', ''));
        $email = trim($request->input('email', ''));
        $password = $request->input('password') ?: $request->input('hashed_password');
        $role = $request->input('role', 'end_user');
        $officeId = $request->input('office_id');

        if (User::where('username', $username)->exists()) {
            return response()->json(['detail' => 'Username already registered'], 400);
        }

        if (User::where('email', $email)->exists()) {
            return response()->json(['detail' => 'Email already registered'], 400);
        }

        if ($officeId && !Office::find($officeId)) {
            return response()->json(['detail' => 'Office not found'], 400);
        }

        $user = User::create([
            'username' => $username,
            'email' => $email,
            'hashed_password' => Hash::make($password),
            'role' => $role,
            'office_id' => $role === 'end_user' ? $officeId : null,
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'User created successfully',
            'username' => $user->username,
        ]);
    }

    public function listUsers(Request $request)
    {
        $users = User::orderBy('username')->get();

        return response()->json($users->map(fn($u) => [
            'id' => $u->id,
            'username' => $u->username,
            'email' => $u->email,
            'role' => $u->role,
            'office_id' => $u->office_id,
            'is_active' => (bool)$u->is_active,
            'created_at' => $u->created_at,
        ]));
    }

    public function updateUser(Request $request, int $id)
    {
        $target = User::find($id);
        if (!$target) {
            return response()->json(['detail' => 'User not found'], 404);
        }

        $currentUser = $request->attributes->get('auth_user') ?: auth()->user();

        if ($request->has('username') && $request->input('username') !== $target->username) {
            $username = trim($request->input('username'));
            if (User::where('username', $username)->where('id', '!=', $id)->exists()) {
                return response()->json(['detail' => 'Username already registered'], 400);
            }
            $target->username = $username;
        }

        if ($request->has('email') && $request->input('email') !== $target->email) {
            $email = trim($request->input('email'));
            if (User::where('email', $email)->where('id', '!=', $id)->exists()) {
                return response()->json(['detail' => 'Email already registered'], 400);
            }
            $target->email = $email;
        }

        if ($request->has('role')) {
            $role = $request->input('role');
            if (!in_array($role, ['end_user', 'budget_office', 'bac_admin'])) {
                return response()->json(['detail' => 'Invalid role'], 400);
            }
            $target->role = $role;
        }

        if ($target->role === 'end_user') {
            if ($request->has('office_id')) {
                $officeId = $request->input('office_id');
                if ($officeId && !Office::find($officeId)) {
                    return response()->json(['detail' => 'Office not found'], 400);
                }
                $target->office_id = $officeId;
            }
        } else {
            $target->office_id = null;
        }

        if ($request->input('password')) {
            $target->hashed_password = Hash::make($request->input('password'));
        }

        if ($request->has('is_active')) {
            $isActive = (bool)$request->input('is_active');
            if ($target->id === $currentUser->id && !$isActive) {
                return response()->json(['detail' => 'You cannot deactivate your own account'], 400);
            }
            $target->is_active = $isActive;
        }

        $target->save();

        return response()->json([
            'message' => 'User updated successfully',
            'user' => [
                'id' => $target->id,
                'username' => $target->username,
                'email' => $target->email,
                'role' => $target->role,
                'office_id' => $target->office_id,
                'is_active' => (bool)$target->is_active,
                'created_at' => $target->created_at,
            ],
        ]);
    }

    public function deleteUser(Request $request, int $id)
    {
        $target = User::find($id);
        if (!$target) {
            return response()->json(['detail' => 'User not found'], 404);
        }

        $currentUser = $request->attributes->get('auth_user') ?: auth()->user();
        if ($target->id === $currentUser->id) {
            return response()->json(['detail' => 'You cannot delete your own account'], 400);
        }

        $officeId = $target->office_id;
        $target->delete();

        return response()->json([
            'message' => 'User account deleted. Office PPMP records and local template files were kept in the system.',
            'user_id' => $id,
            'office_id' => $officeId,
            'ppmps_retained' => true,
        ]);
    }
}
