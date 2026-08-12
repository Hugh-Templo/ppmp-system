<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    /**
     * Named rate limiters for API abuse / DDoS hardening.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(20)->by($request->ip());
        });

        RateLimiter::for('api', function (Request $request) {
            $user = $request->attributes->get('auth_user') ?? $request->user();

            return Limit::perMinute(180)->by($user?->username ?: $request->ip());
        });

        RateLimiter::for('heavy', function (Request $request) {
            $user = $request->attributes->get('auth_user') ?? $request->user();

            return Limit::perMinute(30)->by($user?->username ?: $request->ip());
        });

        RateLimiter::for('public', function (Request $request) {
            return Limit::perMinute(60)->by($request->ip());
        });
    }
}
