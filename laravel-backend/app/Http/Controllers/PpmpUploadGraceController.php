<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use App\Models\PpmpUploadGrace;

class PpmpUploadGraceController extends Controller
{
    /** Any authenticated user — end-user dashboard banner / unlock. */
    public function status()
    {
        return response()->json(PpmpUploadGrace::serialize());
    }

    /** BAC Admin — same payload for the toggle UI. */
    public function show()
    {
        return response()->json(PpmpUploadGrace::serialize());
    }

    /** BAC Admin — enable/disable with required auto-off datetime when enabling. */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'is_enabled' => 'required|boolean',
            'expires_at' => 'nullable|date',
        ]);

        $row = PpmpUploadGrace::current();
        if (!$row) {
            return response()->json([
                'detail' => 'PPMP upload grace settings are unavailable. Run migrations and try again.',
            ], 503);
        }

        $enable = (bool) $validated['is_enabled'];

        if ($enable) {
            if (empty($validated['expires_at'])) {
                return response()->json([
                    'detail' => 'Turn-off date and time is required when enabling the grace period.',
                ], 422);
            }

            $expiresAt = Carbon::parse($validated['expires_at']);
            if ($expiresAt->isPast()) {
                return response()->json([
                    'detail' => 'Turn-off date and time must be in the future.',
                ], 422);
            }

            $row->is_enabled = true;
            $row->expires_at = $expiresAt;
        } else {
            $row->is_enabled = false;
            if (array_key_exists('expires_at', $validated) && !empty($validated['expires_at'])) {
                $row->expires_at = Carbon::parse($validated['expires_at']);
            }
        }

        $row->save();

        return response()->json(PpmpUploadGrace::serialize($row));
    }
}
