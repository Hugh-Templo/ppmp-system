<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Office PPMP Excels often put long multi-item quantity/mode lists in one cell.
     */
    public function up(): void
    {
        foreach (['ppmpitem', 'ppmp_item', 'approw'] as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                if (Schema::hasColumn($table, 'quantity_size')) {
                    $blueprint->text('quantity_size')->nullable()->change();
                }
                if (Schema::hasColumn($table, 'procurement_mode')) {
                    $blueprint->text('procurement_mode')->nullable()->change();
                }
            });
        }
    }

    public function down(): void
    {
        foreach (['ppmpitem', 'ppmp_item', 'approw'] as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                if (Schema::hasColumn($table, 'quantity_size')) {
                    $blueprint->string('quantity_size')->nullable()->change();
                }
                if (Schema::hasColumn($table, 'procurement_mode')) {
                    $blueprint->string('procurement_mode')->nullable()->change();
                }
            });
        }
    }
};
