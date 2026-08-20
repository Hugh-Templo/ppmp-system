<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Throwable;

class SystemMaintenance extends Model
{
    use HasFactory;

    protected $table = 'system_maintenance';

    protected $fillable = [
        'id',
        'is_enabled',
        'message',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
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
                'message' => null,
            ]);
        } catch (Throwable $e) {
            return null;
        }
    }

    public static function isEnabled(): bool
    {
        $row = static::current();

        return $row ? (bool) $row->is_enabled : false;
    }

    public static function bannerMessage(): string
    {
        $row = static::current();
        $custom = $row ? trim((string) $row->message) : '';

        if ($custom !== '') {
            return $custom;
        }

        return 'System is under maintenance. Please try again later.';
    }
}
