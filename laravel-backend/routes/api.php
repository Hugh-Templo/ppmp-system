<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\OfficesController;
use App\Http\Controllers\BudgetController;
use App\Http\Controllers\BacController;
use App\Http\Controllers\DbmController;
use App\Http\Controllers\SuperadminController;

// Health check
Route::get('/health', function () {
    return response()->json(['status' => 'running']);
})->middleware('throttle:public');

// Public endpoint for registration form
Route::get('/offices', [OfficesController::class, 'listOfficesPublic'])
    ->middleware('throttle:public');

// Auth routes
Route::post('/auth/token', [AuthController::class, 'login'])
    ->middleware('throttle:login');
Route::post('/token', [AuthController::class, 'login'])
    ->middleware('throttle:login');

Route::middleware('jwt')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'getMe']);

    Route::middleware('role:bac_admin')->group(function () {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::get('/auth/users', [AuthController::class, 'listUsers']);
        Route::put('/auth/users/{id}', [AuthController::class, 'updateUser']);
        Route::post('/auth/users/{id}/reveal-password', [AuthController::class, 'revealPassword'])
            ->middleware('throttle:login');
        Route::delete('/auth/users/{id}', [AuthController::class, 'deleteUser']);
    });
});

// Office routes
Route::prefix('offices')->group(function () {
    Route::middleware('jwt')->group(function () {
        Route::get('/item-catalog', [OfficesController::class, 'getItemCatalog']);
        Route::get('/signatory', [OfficesController::class, 'getSignatory']);
        Route::post('/signatory', [OfficesController::class, 'updateSignatory']);
        Route::get('/budget/{office_id}', [OfficesController::class, 'getOfficeBudget']);
        Route::put('/budget/{office_id}', [OfficesController::class, 'updateOfficeBudget']);

        Route::get('/ppmps', [OfficesController::class, 'listPpmps']);
        Route::post('/ppmps/upload', [OfficesController::class, 'uploadPpmp'])
            ->middleware('throttle:heavy');
        Route::get('/ppmps/{id}', [OfficesController::class, 'getPpmp']);
        Route::get('/ppmps/{id}/export', [OfficesController::class, 'exportPpmp'])
            ->middleware('throttle:heavy');
        Route::post('/ppmps/{id}/submit', [OfficesController::class, 'submitPpmp']);
        Route::delete('/ppmps/{id}', [OfficesController::class, 'deletePpmp']);
    });
});

// Budget routes
Route::prefix('budget')->middleware(['jwt', 'role:budget_office,bac_admin'])->group(function () {
    Route::get('/pending', [BudgetController::class, 'listPendingPpmps']);
    Route::get('/ppmps/posting', [BudgetController::class, 'listPostingPpmps']);
    Route::get('/office-tracker', [BudgetController::class, 'officeTracker']);
    Route::get('/indicative/pending', [BudgetController::class, 'listPendingIndicativePpmps']);
    Route::get('/indicative', [BudgetController::class, 'listIndicativePpmps']);
    Route::get('/final', [BudgetController::class, 'listFinalPpmps']);

    Route::post('/indicative/ppmps/{id}/post', [BudgetController::class, 'postIndicativePpmp']);
    Route::post('/indicative/ppmps/{id}/unpost', [BudgetController::class, 'unpostIndicativePpmp']);
    Route::get('/ppmps/{id}/audit', [BudgetController::class, 'auditPpmp']);
    Route::post('/ppmps/{id}/review', [BudgetController::class, 'reviewPpmp']);
});

// BAC routes
Route::prefix('bac')->middleware(['jwt', 'role:bac_admin'])->group(function () {
    Route::get('/app-signatory', [BacController::class, 'getAppSignatory']);
    Route::put('/app-signatory', [BacController::class, 'updateAppSignatory']);
    Route::get('/offices', [BacController::class, 'listOffices']);
    Route::post('/offices', [BacController::class, 'createOffice']);
    Route::put('/offices/{id}', [BacController::class, 'updateOffice']);
    Route::delete('/offices/{id}', [BacController::class, 'deleteOffice']);

    Route::post('/consolidate/{fiscal_year}', [BacController::class, 'consolidatePpmps'])
        ->middleware('throttle:heavy');
    Route::get('/ppmps', [BacController::class, 'listAllPpmps']);
    Route::get('/ppmps/approved', [BacController::class, 'listApprovedPpmps']);
    Route::post('/indicative/ppmps/{id}/approve', [BacController::class, 'approveIndicativePpmp']);
    Route::post('/indicative/ppmps/{id}/reject', [BacController::class, 'rejectIndicativePpmp']);
    Route::get('/apps', [BacController::class, 'listApps']);
    Route::get('/apps/by-year/{fiscal_year}', [BacController::class, 'getAppByYear']);
    Route::get('/apps/{fiscal_year}/export/{kind}', [BacController::class, 'exportApp'])
        ->middleware('throttle:heavy');
    Route::get('/apps/{id}', [BacController::class, 'getApp']);
    Route::post('/drive/upload', [BacController::class, 'uploadToDrive'])
        ->middleware('throttle:heavy');
});

// Superadmin monitoring
Route::prefix('superadmin')->middleware(['jwt', 'role:super_admin'])->group(function () {
    Route::get('/overview', [SuperadminController::class, 'overview']);
    Route::get('/activity', [SuperadminController::class, 'activity']);
    Route::get('/logins', [SuperadminController::class, 'logins']);
    Route::get('/errors', [SuperadminController::class, 'errors']);
});

// DBM routes
Route::prefix('dbm')->middleware('jwt')->group(function () {
    Route::get('/classifications', [DbmController::class, 'listClassifications']);
    Route::post('/classifications', [DbmController::class, 'createClassification']);
    Route::get('/classifications/{id}', [DbmController::class, 'getClassification']);
    Route::delete('/classifications/{id}', [DbmController::class, 'deleteClassification']);
});
