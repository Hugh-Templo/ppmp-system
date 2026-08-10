<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ppmp extends Model
{
    use HasFactory;

    protected $table = 'ppmp';

    protected $fillable = [
        'title',
        'fiscal_year',
        'office_id',
        'status',
        'type',
        'is_cse',
        'remarks',
    ];

    protected $casts = [
        'fiscal_year' => 'integer',
        'office_id' => 'integer',
        'is_cse' => 'boolean',
    ];

    public function office()
    {
        return $this->belongsTo(Office::class, 'office_id');
    }

    public function items()
    {
        return $this->hasMany(PpmpItem::class, 'ppmp_id');
    }
}
