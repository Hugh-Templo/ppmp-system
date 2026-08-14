<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemLoginLog extends Model
{
    protected $table = 'system_login_logs';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'username',
        'ip_address',
        'user_agent',
        'success',
        'created_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'success' => 'boolean',
        'created_at' => 'datetime',
    ];
}
