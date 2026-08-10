<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Exception;

class JwtService
{
    public static function getSecretKey(): string
    {
        return config('app.jwt_secret') ?: config('app.key') ?: 'secret-key-fallback';
    }

    public static function getAlgorithm(): string
    {
        return config('app.jwt_algorithm', 'HS256');
    }

    public static function createToken(array $data, int $expiresInMinutes = 60): string
    {
        $payload = array_merge($data, [
            'iat' => time(),
            'exp' => time() + ($expiresInMinutes * 60),
        ]);

        return JWT::encode($payload, self::getSecretKey(), self::getAlgorithm());
    }

    public static function decodeToken(string $token): ?object
    {
        try {
            return JWT::decode($token, new Key(self::getSecretKey(), self::getAlgorithm()));
        } catch (Exception $e) {
            return null;
        }
    }
}
