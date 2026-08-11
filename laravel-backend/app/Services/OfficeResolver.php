<?php

namespace App\Services;

use App\Models\Office;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class OfficeResolver
{
    /**
     * Resolve an office by id, or find/create by name + code (end-user registration).
     */
    public static function resolveOrCreate(
        ?int $officeId = null,
        ?string $officeName = null,
        ?string $officeCode = null
    ): ?Office {
        if ($officeId) {
            return Office::find($officeId);
        }

        $name = trim((string) $officeName);
        $code = strtoupper(trim((string) $officeCode));

        if ($name === '' && $code === '') {
            return null;
        }

        if ($name === '' || $code === '') {
            throw new HttpResponseException(response()->json([
                'detail' => 'Office name and code are required for end-user accounts',
            ], 400));
        }

        $existingByCode = Office::where('code', $code)->first();
        if ($existingByCode) {
            if ($existingByCode->name !== $name) {
                $existingByCode->name = $name;
            }
            if (!$existingByCode->is_active) {
                $existingByCode->is_active = true;
            }
            $existingByCode->save();

            return $existingByCode;
        }

        $existingByName = Office::where('name', $name)->first();
        if ($existingByName) {
            if ($existingByName->code !== $code) {
                $existingByName->code = $code;
                $existingByName->save();
            }

            return $existingByName;
        }

        return Office::create([
            'name' => $name,
            'code' => $code,
            'budget_allocation' => 0.0,
            'is_active' => true,
            'created_at' => now(),
        ]);
    }

    /**
     * Ensure an end-user has an office_id (match username to office code, or create).
     */
    public static function ensureUserOffice(User $user): ?Office
    {
        if ($user->office_id) {
            $office = Office::find($user->office_id);
            if ($office) {
                return $office;
            }
        }

        if ($user->role !== 'end_user') {
            return null;
        }

        $username = strtoupper(trim((string) $user->username));
        $aliases = [
            'CMO' => 'O-CMO',
            'CHO' => 'O-CHO',
            'GSO' => 'O-GSO',
            'BAC' => 'O-BAC',
            'BUDGET' => 'O-BUDGET',
        ];
        $preferred = $aliases[$username] ?? $username;

        $office = Office::whereRaw('UPPER(code) = ?', [$preferred])->first()
            ?: Office::whereRaw('UPPER(code) = ?', [$username])->first()
            ?: Office::whereRaw("UPPER(REPLACE(REPLACE(code, 'O-', ''), 'O_', '')) = ?", [$username])->first();

        // Do not fuzzy-match office names (e.g. "IT" inside "Committee").
        if (!$office) {
            $office = self::resolveOrCreate(null, $username . ' Office', $username);
        }

        if ($office) {
            DB::table('users')
                ->where('id', $user->id)
                ->update(['office_id' => $office->id]);
            $user->office_id = $office->id;
        }

        return $office;
    }
}
