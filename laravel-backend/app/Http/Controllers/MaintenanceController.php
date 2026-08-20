<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\SystemMaintenance;

class MaintenanceController extends Controller
{
    private function serialize(?SystemMaintenance $row): array
    {
        return [
            'is_enabled' => $row ? (bool) $row->is_enabled : false,
            'message' => $row && $row->message !== null && $row->message !== ''
                ? (string) $row->message
                : null,
        ];
    }

    /** Public — login page banner. */
    public function status()
    {
        return response()->json($this->serialize(SystemMaintenance::current()));
    }

    /** BAC Admin — same payload for the toggle UI. */
    public function show()
    {
        return response()->json($this->serialize(SystemMaintenance::current()));
    }

    /** BAC Admin — enable/disable and optional message. */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'is_enabled' => 'required|boolean',
            'message' => 'nullable|string|max:2000',
        ]);

        $row = SystemMaintenance::current();
        if (!$row) {
            return response()->json([
                'detail' => 'Maintenance settings are unavailable. Run migrations and try again.',
            ], 503);
        }

        $message = array_key_exists('message', $validated)
            ? trim((string) ($validated['message'] ?? ''))
            : trim((string) ($row->message ?? ''));

        $row->is_enabled = (bool) $validated['is_enabled'];
        $row->message = $message === '' ? null : $message;
        $row->save();

        return response()->json($this->serialize($row));
    }
}
