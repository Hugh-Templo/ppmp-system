<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DbmClassification extends Model
{
    use HasFactory;

    protected $table = 'dbm_classification';

    protected $fillable = [
        'code',
        'project_title',
        'classification',
    ];
}
