<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('ppmp')) {
            return;
        }

        Schema::table('ppmp', function (Blueprint $table) {
            if (!Schema::hasColumn('ppmp', 'excel_path')) {
                $table->string('excel_path', 500)->nullable()->after('remarks');
            }
            if (!Schema::hasColumn('ppmp', 'excel_filename')) {
                $table->string('excel_filename', 255)->nullable()->after('excel_path');
            }
            if (!Schema::hasColumn('ppmp', 'excel_mime')) {
                $table->string('excel_mime', 120)->nullable()->after('excel_filename');
            }
            if (!Schema::hasColumn('ppmp', 'excel_size')) {
                $table->unsignedInteger('excel_size')->nullable()->after('excel_mime');
            }
        });

        // Laravel's binary() maps to 64KB BLOB — too small for Excel. Use LONGBLOB.
        if (!Schema::hasColumn('ppmp', 'excel_blob')) {
            DB::statement('ALTER TABLE `ppmp` ADD `excel_blob` LONGBLOB NULL AFTER `excel_size`');
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('ppmp')) {
            return;
        }

        Schema::table('ppmp', function (Blueprint $table) {
            foreach (['excel_size', 'excel_mime', 'excel_filename', 'excel_path'] as $col) {
                if (Schema::hasColumn('ppmp', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        if (Schema::hasColumn('ppmp', 'excel_blob')) {
            DB::statement('ALTER TABLE `ppmp` DROP COLUMN `excel_blob`');
        }
    }
};
