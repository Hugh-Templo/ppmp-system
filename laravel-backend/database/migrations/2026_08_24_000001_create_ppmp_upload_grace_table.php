<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ppmp_upload_grace')) {
            return;
        }

        Schema::create('ppmp_upload_grace', function (Blueprint $table) {
            $table->id();
            $table->boolean('is_enabled')->default(false)->index();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });

        DB::table('ppmp_upload_grace')->insert([
            'id' => 1,
            'is_enabled' => false,
            'expires_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('ppmp_upload_grace');
    }
};
