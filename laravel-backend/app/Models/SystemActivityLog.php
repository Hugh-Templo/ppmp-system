<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemActivityLog extends Model
{
    protected $table = 'system_activity_logs';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'username',
        'method',
        'path',
        'status_code',
        'ip_address',
        'duration_ms',
        'created_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'status_code' => 'integer',
        'duration_ms' => 'integer',
        'created_at' => 'datetime',
    ];
}
