<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('office_notifications', function (Blueprint $table) {
            $table->unsignedInteger('emails_queued')->default(0)->after('emailed_at');
        });
    }

    public function down(): void
    {
        Schema::table('office_notifications', function (Blueprint $table) {
            $table->dropColumn('emails_queued');
        });
    }
};
