<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SyncLog extends Model
{
    use HasFactory;

    protected $table = 'synclog';

    public $timestamps = false;

    protected $fillable = [
        'ran_at',
        'success',
        'files_processed',
        'message',
    ];

    protected $casts = [
        'ran_at' => 'datetime',
        'success' => 'boolean',
        'files_processed' => 'integer',
    ];
}
