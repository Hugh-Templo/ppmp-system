<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class App extends Model
{
    use HasFactory;

    protected $table = 'app';

    protected $fillable = [
        'title',
        'fiscal_year',
        'status',
        'approved_at',
    ];

    protected $casts = [
        'fiscal_year' => 'integer',
        'approved_at' => 'datetime',
    ];

    public function rows()
    {
        return $this->hasMany(AppRow::class, 'app_id');
    }
}
