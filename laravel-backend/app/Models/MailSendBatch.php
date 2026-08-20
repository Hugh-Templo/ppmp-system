<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MailSendBatch extends Model
{
    public $timestamps = false;

    protected $table = 'mail_send_batches';

    protected $fillable = [
        'channel',
        'reference_id',
        'emails_queued',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'reference_id' => 'integer',
            'emails_queued' => 'integer',
            'created_at' => 'datetime',
        ];
    }
}
