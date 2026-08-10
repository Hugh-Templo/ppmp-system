<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FinalPpmp extends Model
{
    use HasFactory;

    protected $table = 'final_ppmp';

    protected $fillable = [
        'title',
        'fiscal_year',
        'office_id',
        'status',
        'type',
        'approval_status',
        'submitted_at',
        'approved_at',
        'approved_by',
        'verification_notes',
        'remarks',
        'version',
    ];

    protected $casts = [
        'fiscal_year' => 'integer',
        'office_id' => 'integer',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
        'approved_by' => 'integer',
        'version' => 'integer',
    ];

    public function office()
    {
        return $this->belongsTo(Office::class, 'office_id');
    }
}
