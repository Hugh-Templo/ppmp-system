<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Office extends Model
{
    use HasFactory;

    // Legacy SQLModel table name (singular)
    protected $table = 'office';

    public $timestamps = false;

    protected $fillable = [
        'name',
        'code',
        'budget_allocation',
        'is_active',
        'submitted_by',
        'submitted_by_designation',
        'prepared_by',
        'prepared_by_designation',
        'aip_reference',
        'responsibility_center_no',
        'office_code_from_pr',
        'ppmp_template_path',
    ];

    protected $casts = [
        'budget_allocation' => 'float',
        'is_active' => 'boolean',
    ];

    public function setNameAttribute($value): void
    {
        $this->attributes['name'] = mb_strtoupper(trim((string) $value), 'UTF-8');
    }

    public function setCodeAttribute($value): void
    {
        $this->attributes['code'] = mb_strtoupper(trim((string) $value), 'UTF-8');
    }

    private function upperOrNull($value): ?string
    {
        if ($value === null) {
            return null;
        }
        $text = mb_strtoupper(trim((string) $value), 'UTF-8');
        return $text === '' ? null : $text;
    }

    public function setPreparedByAttribute($value): void
    {
        $this->attributes['prepared_by'] = $this->upperOrNull($value);
    }

    public function setPreparedByDesignationAttribute($value): void
    {
        $this->attributes['prepared_by_designation'] = $this->upperOrNull($value);
    }

    public function setSubmittedByAttribute($value): void
    {
        $this->attributes['submitted_by'] = $this->upperOrNull($value);
    }

    public function setSubmittedByDesignationAttribute($value): void
    {
        $this->attributes['submitted_by_designation'] = $this->upperOrNull($value);
    }

    public function users()
    {
        return $this->hasMany(User::class, 'office_id');
    }

    public function ppmps()
    {
        return $this->hasMany(Ppmp::class, 'office_id');
    }
}
