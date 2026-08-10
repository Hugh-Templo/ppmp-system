<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AppRow extends Model
{
    use HasFactory;

    protected $table = 'approw';

    protected $fillable = [
        'app_id',
        'description',
        'is_cse',
        'project_type',
        'procurement_mode',
        'fund_source',
        'quantity_size',
        'proc_start',
        'proc_end',
        'delivery_period',
        'pre_proc_conf',
        'total_estimated_budget',
        'end_user_offices',
        'category',
        'total_quantity',
        'unit_of_measure',
        'unit_cost',
        'q1_qty',
        'q2_qty',
        'q3_qty',
        'q4_qty',
    ];

    protected $casts = [
        'app_id' => 'integer',
        'is_cse' => 'boolean',
        'pre_proc_conf' => 'boolean',
        'total_estimated_budget' => 'float',
        'total_quantity' => 'integer',
        'unit_cost' => 'float',
        'q1_qty' => 'integer',
        'q2_qty' => 'integer',
        'q3_qty' => 'integer',
        'q4_qty' => 'integer',
    ];

    public function app()
    {
        return $this->belongsTo(App::class, 'app_id');
    }
}
