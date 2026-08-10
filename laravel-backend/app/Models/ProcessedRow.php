<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProcessedRow extends Model
{
    use HasFactory;

    protected $table = 'processed_row';

    protected $fillable = [
        'source_file',
        'row_data',
        'imported_at',
    ];

    protected $casts = [
        'imported_at' => 'datetime',
    ];
}
