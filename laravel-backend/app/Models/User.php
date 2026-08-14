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
        'password_encrypted',
        'is_active',
        'role',
        'office_id',
    ];

    protected $hidden = [
        'hashed_password',
        'password_encrypted',
        'remember_token',
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

    public function setUsernameAttribute($value): void
    {
        $this->attributes['username'] = mb_strtoupper(trim((string) $value), 'UTF-8');
    }

    public function office()
    {
        return $this->belongsTo(Office::class, 'office_id');
    }
}
