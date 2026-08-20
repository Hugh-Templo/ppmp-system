<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mail_send_batches', function (Blueprint $table) {
            $table->id();
            $table->string('channel', 50)->default('office_notification')->index();
            $table->unsignedBigInteger('reference_id')->nullable()->index();
            $table->unsignedInteger('emails_queued');
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mail_send_batches');
    }
};
