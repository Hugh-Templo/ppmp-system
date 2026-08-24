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
        'posting_status',
        'posted_at',
        'posted_by',
        'type',
        'is_cse',
        'remarks',
        'superseded_at',
        'excel_path',
        'excel_filename',
        'excel_mime',
        'excel_size',
        'excel_blob',
    ];

    /**
     * Never send the binary Excel blob in normal JSON API responses.
     */
    protected $hidden = [
        'excel_blob',
    ];

    protected $casts = [
        'fiscal_year' => 'integer',
        'office_id' => 'integer',
        'is_cse' => 'boolean',
        'posted_at' => 'datetime',
        'posted_by' => 'integer',
        'excel_size' => 'integer',
        'superseded_at' => 'datetime',
    ];

    protected $appends = [
        'has_excel_file',
    ];

    public function getHasExcelFileAttribute(): bool
    {
        if (!empty($this->attributes['excel_path'] ?? null)) {
            return true;
        }
        if (!empty($this->attributes['excel_filename'] ?? null)) {
            return true;
        }
        // Avoid loading blob content; check length via attribute presence only when selected.
        return array_key_exists('excel_blob', $this->attributes)
            && $this->attributes['excel_blob'] !== null
            && $this->attributes['excel_blob'] !== '';
    }

    public function office()
    {
        return $this->belongsTo(Office::class, 'office_id');
    }

    public function items()
    {
        return $this->hasMany(PpmpItem::class, 'ppmp_id');
    }

    /**
     * Absolute path on disk for the stored Excel file, if present.
     */
    public function absoluteExcelPath(): ?string
    {
        $path = $this->excel_path;
        if (!$path) {
            return null;
        }
        if (str_starts_with($path, DIRECTORY_SEPARATOR) || preg_match('/^[A-Za-z]:\\\\/', $path) || preg_match('/^[A-Za-z]:\//', $path)) {
            return $path;
        }
        return base_path('IT_ppmps' . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path));
    }
}
