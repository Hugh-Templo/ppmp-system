<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OfficeNotification extends Model
{
    use HasFactory;

    protected $table = 'office_notifications';

    protected $fillable = [
        'fiscal_year',
        'title',
        'message',
        'deadline_at',
        'status',
        'emailed_at',
        'emails_queued',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'fiscal_year' => 'integer',
            'deadline_at' => 'date',
            'emailed_at' => 'datetime',
            'emails_queued' => 'integer',
        ];
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
