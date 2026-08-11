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

        Schema::table('ppmp', function (Blueprint $table) {
            if (!Schema::hasColumn('ppmp', 'posting_status')) {
                $table->string('posting_status')->default('Draft')->after('status');
            }
            if (!Schema::hasColumn('ppmp', 'posted_at')) {
                $table->timestamp('posted_at')->nullable()->after('posting_status');
            }
            if (!Schema::hasColumn('ppmp', 'posted_by')) {
                $table->unsignedBigInteger('posted_by')->nullable()->after('posted_at');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('ppmp')) {
            return;
        }

        Schema::table('ppmp', function (Blueprint $table) {
            if (Schema::hasColumn('ppmp', 'posted_by')) {
                $table->dropColumn('posted_by');
            }
            if (Schema::hasColumn('ppmp', 'posted_at')) {
                $table->dropColumn('posted_at');
            }
            if (Schema::hasColumn('ppmp', 'posting_status')) {
                $table->dropColumn('posting_status');
            }
        });
    }
};
