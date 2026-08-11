<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DbmClassification extends Model
{
    use HasFactory;

    protected $table = 'dbmclassification';

    const UPDATED_AT = null;

    protected $fillable = [
        'code',
        'project_title',
        'classification',
    ];
}
