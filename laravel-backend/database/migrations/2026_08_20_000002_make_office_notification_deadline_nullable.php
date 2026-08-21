<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('office_notifications')) {
            return;
        }

        DB::statement('ALTER TABLE office_notifications MODIFY deadline_at DATE NULL');
    }

    public function down(): void
    {
        if (!Schema::hasTable('office_notifications')) {
            return;
        }

        DB::statement("UPDATE office_notifications SET deadline_at = CURRENT_DATE WHERE deadline_at IS NULL");
        DB::statement('ALTER TABLE office_notifications MODIFY deadline_at DATE NOT NULL');
    }
};
