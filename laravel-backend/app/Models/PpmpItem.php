<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PpmpItem extends Model
{
    use HasFactory;

    protected $table = 'ppmp_item';

    protected $fillable = [
        'ppmp_id',
        'indicative_ppmp_id',
        'sheet_row_id',
        'description',
        'project_type',
        'quantity_size',
        'is_cse',
        'procurement_mode',
        'pre_proc_conf',
        'proc_start',
        'proc_end',
        'delivery_period',
        'fund_source',
        'estimated_budget',
        'supporting_docs',
        'remarks',
        'category',
        'quantity',
        'unit_of_measure',
        'unit_cost',
        'q1_qty',
        'q2_qty',
        'q3_qty',
        'q4_qty',
    ];

    protected $casts = [
        'ppmp_id' => 'integer',
        'indicative_ppmp_id' => 'integer',
        'sheet_row_id' => 'integer',
        'is_cse' => 'boolean',
        'pre_proc_conf' => 'boolean',
        'estimated_budget' => 'float',
        'quantity' => 'integer',
        'unit_cost' => 'float',
        'q1_qty' => 'integer',
        'q2_qty' => 'integer',
        'q3_qty' => 'integer',
        'q4_qty' => 'integer',
    ];

    public function ppmp()
    {
        return $this->belongsTo(Ppmp::class, 'ppmp_id');
    }

    public function indicativePpmp()
    {
        return $this->belongsTo(IndicativePpmp::class, 'indicative_ppmp_id');
    }
}
