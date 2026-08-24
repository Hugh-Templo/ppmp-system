<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('ppmp')) {
            return;
        }

        if (!Schema::hasColumn('ppmp', 'superseded_at')) {
            Schema::table('ppmp', function (Blueprint $table) {
                $table->timestamp('superseded_at')->nullable()->index()->after('remarks');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('ppmp') && Schema::hasColumn('ppmp', 'superseded_at')) {
            Schema::table('ppmp', function (Blueprint $table) {
                $table->dropColumn('superseded_at');
            });
        }
    }
};
