<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $table = 'users';

    protected $fillable = [
        'username',
        'email',
        'hashed_password',
        'is_active',
        'role',
        'office_id',
    ];

    protected $hidden = [
        'hashed_password',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function getAuthPasswordName(): string
    {
        return 'hashed_password';
    }

    public function office()
    {
        return $this->belongsTo(Office::class, 'office_id');
    }
}
