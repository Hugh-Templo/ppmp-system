<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('app_signatory')) {
            return;
        }

        Schema::create('app_signatory', function (Blueprint $table) {
            $table->id();
            $table->string('prepared_by')->nullable();
            $table->string('prepared_by_designation')->nullable();
            $table->string('recommended_by')->nullable();
            $table->string('recommended_by_designation')->nullable();
            $table->string('approved_by_name')->nullable();
            $table->string('approved_by_designation')->nullable();
            $table->timestamps();
        });

        DB::table('app_signatory')->insert([
            'id' => 1,
            'prepared_by' => null,
            'prepared_by_designation' => null,
            'recommended_by' => null,
            'recommended_by_designation' => null,
            'approved_by_name' => null,
            'approved_by_designation' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('app_signatory');
    }
};
