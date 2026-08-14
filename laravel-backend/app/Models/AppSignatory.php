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

    private function upperOrNull($value): ?string
    {
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

    public function setRecommendedByAttribute($value): void
    {
        $this->attributes['recommended_by'] = $this->upperOrNull($value);
    }

    public function setRecommendedByDesignationAttribute($value): void
    {
        $this->attributes['recommended_by_designation'] = $this->upperOrNull($value);
    }

    public function setApprovedByNameAttribute($value): void
    {
        $this->attributes['approved_by_name'] = $this->upperOrNull($value);
    }

    public function setApprovedByDesignationAttribute($value): void
    {
        $this->attributes['approved_by_designation'] = $this->upperOrNull($value);
    }
}
