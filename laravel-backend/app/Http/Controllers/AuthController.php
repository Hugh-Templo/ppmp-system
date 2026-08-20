<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use App\Models\Office;
use App\Models\SystemLoginLog;
use App\Models\SystemMaintenance;
use App\Services\JwtService;
use App\Services\OfficeResolver;
use Throwable;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $username = mb_strtoupper(trim((string) $request->input('username')), 'UTF-8');
        $password = $request->input('password');

        if (!$username || !$password) {
            $this->recordLoginAttempt($request, $username ?: null, null, false);
            return response()->json(['detail' => 'Incorrect username or password'], 401);
        }

        try {
            $user = User::whereRaw('UPPER(username) = ?', [$username])->first();
        } catch (Throwable $e) {
            Log::error('Login database error', ['error' => $e->getMessage()]);
            return response()->json([
                'detail' => 'Database is unavailable. Start MySQL in XAMPP and try again.',
            ], 503);
        }

        if (!$user || !Hash::check($password, $user->hashed_password)) {
            $this->recordLoginAttempt($request, $username, $user?->id, false);
            return response()->json(['detail' => 'Incorrect username or password'], 401);
        }

        if (!$user->is_active) {
            $this->recordLoginAttempt($request, $username, $user->id, false);
            return response()->json(['detail' => 'Incorrect username or password'], 401);
        }

        $allowedDuringMaintenance = in_array($user->role, ['bac_admin', 'super_admin'], true);
        if (SystemMaintenance::isEnabled() && !$allowedDuringMaintenance) {
            $this->recordLoginAttempt($request, $username, $user->id, false);
            return response()->json([
                'detail' => SystemMaintenance::bannerMessage(),
            ], 503);
        }

        $this->recordLoginAttempt($request, $username, $user->id, true);
        $token = JwtService::createToken(['sub' => $user->username]);

        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
        ]);
    }

    private function recordLoginAttempt(Request $request, ?string $username, ?int $userId, bool $success): void
    {
        try {
            SystemLoginLog::create([
                'user_id' => $userId,
                'username' => $username ? mb_substr($username, 0, 255) : null,
                'ip_address' => $request->ip(),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 2000),
                'success' => $success,
                'created_at' => now(),
            ]);
        } catch (Throwable $e) {
            Log::warning('Failed to write login log', ['error' => $e->getMessage()]);
        }
    }

    public function getMe(Request $request)
    {
        $user = $this->authUser($request);
        if ($user->role === 'end_user') {
            OfficeResolver::ensureUserOffice($user);
            $user->refresh();
        }

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
        $currentUser = $this->authUser($request);
        if ($currentUser->role !== 'bac_admin') {
            return response()->json(['detail' => 'Access denied: Only BAC administrators can register users'], 403);
        }

        $username = mb_strtoupper(trim($request->input('username', '')), 'UTF-8');
        $email = trim($request->input('email', ''));
        $password = $request->input('password') ?: $request->input('hashed_password');
        $role = $request->input('role', 'end_user');
        $officeId = null;

        if ($role === 'end_user') {
            $office = OfficeResolver::resolveOrCreate(
                $request->input('office_id') ? (int) $request->input('office_id') : null,
                $request->input('office_name'),
                $request->input('office_code')
            );
            if (!$office) {
                return response()->json([
                    'detail' => 'Office name and code are required for end-user accounts',
                ], 400);
            }
            $officeId = $office->id;
        } elseif ($request->input('office_id') && !Office::find($request->input('office_id'))) {
            return response()->json(['detail' => 'Office not found'], 400);
        }

        if (User::where('username', $username)->exists()) {
            return response()->json(['detail' => 'Username already registered'], 400);
        }

        if (User::where('email', $email)->exists()) {
            return response()->json(['detail' => 'Email already registered'], 400);
        }

        $user = User::create([
            'username' => $username,
            'email' => $email,
            'hashed_password' => Hash::make($password),
            'password_encrypted' => $password ? Crypt::encryptString((string) $password) : null,
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

        $currentUser = $this->authUser($request);

        if ($request->has('username') && $request->input('username') !== $target->username) {
            $username = mb_strtoupper(trim($request->input('username')), 'UTF-8');
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
            if (
                $request->has('office_id')
                || $request->has('office_name')
                || $request->has('office_code')
            ) {
                $office = OfficeResolver::resolveOrCreate(
                    $request->has('office_id') ? (int) $request->input('office_id') : null,
                    $request->input('office_name'),
                    $request->input('office_code')
                );
                if ($office) {
                    $target->office_id = $office->id;
                }
            }
        } else {
            $target->office_id = null;
        }

        if ($request->input('password')) {
            $plain = (string) $request->input('password');
            $target->hashed_password = Hash::make($plain);
            $target->password_encrypted = Crypt::encryptString($plain);
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

    public function revealPassword(Request $request, int $id)
    {
        $admin = $this->authUser($request);
        if (!$admin || $admin->role !== 'bac_admin') {
            return response()->json(['detail' => 'Access denied'], 403);
        }

        $adminPassword = (string) $request->input('password', '');
        if ($adminPassword === '') {
            return response()->json(['detail' => 'Enter your administrator password'], 400);
        }

        if (!Hash::check($adminPassword, $admin->hashed_password)) {
            return response()->json(['detail' => 'Incorrect administrator password'], 401);
        }

        $target = User::find($id);
        if (!$target) {
            return response()->json(['detail' => 'User not found'], 404);
        }

        if (!in_array($target->role, ['end_user', 'budget_office'], true)) {
            return response()->json([
                'detail' => 'Password reveal is only available for end-user and budget office accounts',
            ], 400);
        }

        if (empty($target->password_encrypted)) {
            return response()->json([
                'detail' => 'No recoverable password is stored for this account. Edit the user and set a new password, then you can reveal it.',
            ], 404);
        }

        try {
            $plain = Crypt::decryptString($target->password_encrypted);
        } catch (Throwable $e) {
            return response()->json([
                'detail' => 'Stored password could not be decrypted. Edit the user and set a new password.',
            ], 500);
        }

        if ($plain === '') {
            return response()->json([
                'detail' => 'No recoverable password is stored for this account. Edit the user and set a new password, then you can reveal it.',
            ], 404);
        }

        return response()->json([
            'password' => $plain,
            'user_id' => $target->id,
            'username' => $target->username,
        ]);
    }

    public function deleteUser(Request $request, int $id)
    {
        $target = User::find($id);
        if (!$target) {
            return response()->json(['detail' => 'User not found'], 404);
        }

        $currentUser = $this->authUser($request);
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
