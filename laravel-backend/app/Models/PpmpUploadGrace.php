<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Throwable;

class PpmpUploadGrace extends Model
{
    use HasFactory;

    protected $table = 'ppmp_upload_grace';

    protected $fillable = [
        'id',
        'is_enabled',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'expires_at' => 'datetime',
        ];
    }

    /**
     * Singleton row (id = 1). Fail-open: returns null if the table is missing.
     */
    public static function current(): ?self
    {
        try {
            $row = static::find(1);
            if ($row) {
                return $row;
            }

            return static::create([
                'id' => 1,
                'is_enabled' => false,
                'expires_at' => null,
            ]);
        } catch (Throwable $e) {
            return null;
        }
    }

    /**
     * Active only when enabled and expires_at is still in the future.
     * Lazily disables the flag when the window has passed.
     */
    public static function isActive(): bool
    {
        $row = static::current();
        if (!$row) {
            return false;
        }

        if (!$row->is_enabled) {
            return false;
        }

        if (!$row->expires_at || $row->expires_at->isPast()) {
            if ($row->is_enabled) {
                $row->is_enabled = false;
                try {
                    $row->save();
                } catch (Throwable $e) {
                    // ignore persistence failure; still treat as inactive
                }
            }

            return false;
        }

        return true;
    }

    public static function serialize(?self $row = null): array
    {
        // Trigger lazy expiry, then re-read the singleton for a consistent payload.
        $active = static::isActive();
        $row = static::current();
        $expiresAt = ($row && $row->expires_at)
            ? $row->expires_at->toIso8601String()
            : null;

        return [
            'is_enabled' => $active,
            'expires_at' => $expiresAt,
            'is_active' => $active,
        ];
    }
}
