<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CseCatalogItem extends Model
{
    use HasFactory;

    protected $table = 'cse_catalog_item';

    protected $fillable = [
        'code',
        'description',
        'unit_of_measure',
        'category',
        'is_cse',
        'source',
    ];

    protected $casts = [
        'is_cse' => 'boolean',
    ];
}
