<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AppSignatory extends Model
{
    use HasFactory;

    protected $table = 'app_signatory';

    protected $fillable = [
        'id',
        'prepared_by',
        'prepared_by_designation',
        'recommended_by',
        'recommended_by_designation',
        'approved_by_name',
        'approved_by_designation',
    ];
}
