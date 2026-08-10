<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IndicativePpmp extends Model
{
    use HasFactory;

    protected $table = 'indicative_ppmp';

    protected $fillable = [
        'title',
        'fiscal_year',
        'office_id',
        'status',
        'type',
        'posting_status',
        'posted_at',
        'posted_by',
        'market_scoping_docs',
        'life_cycle_costing',
        'rejection_remarks',
        'rejected_at',
        'rejected_by',
        'approved_at',
        'approved_by',
        'remarks',
        'spreadsheet_id',
    ];

    protected $casts = [
        'fiscal_year' => 'integer',
        'office_id' => 'integer',
        'posted_at' => 'datetime',
        'posted_by' => 'integer',
        'life_cycle_costing' => 'float',
        'rejected_at' => 'datetime',
        'rejected_by' => 'integer',
        'approved_at' => 'datetime',
        'approved_by' => 'integer',
    ];

    public function office()
    {
        return $this->belongsTo(Office::class, 'office_id');
    }

    public function items()
    {
        return $this->hasMany(PpmpItem::class, 'indicative_ppmp_id');
    }
}
