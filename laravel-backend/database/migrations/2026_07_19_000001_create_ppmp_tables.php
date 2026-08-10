<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Offices
        Schema::create('offices', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('code')->unique();
            $table->double('budget_allocation')->default(0.0);
            $table->boolean('is_active')->default(true)->index();
            $table->string('submitted_by')->nullable();
            $table->string('submitted_by_designation')->nullable();
            $table->string('prepared_by')->nullable();
            $table->string('prepared_by_designation')->nullable();
            $table->string('aip_reference')->nullable();
            $table->string('responsibility_center_no')->nullable();
            $table->string('office_code_from_pr')->nullable();
            $table->string('ppmp_template_path')->nullable();
            $table->timestamps();
        });

        // 2. Users (override default users table)
        Schema::dropIfExists('users');
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('username')->unique()->index();
            $table->string('email')->unique()->index();
            $table->string('hashed_password');
            $table->boolean('is_active')->default(true);
            $table->string('role')->default('end_user'); // end_user, budget_office, bac_admin
            $table->foreignId('office_id')->nullable()->constrained('offices')->nullOnDelete();
            $table->timestamps();
        });

        // 3. PPMP (Base PPMP)
        Schema::create('ppmp', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->integer('fiscal_year')->index();
            $table->foreignId('office_id')->constrained('offices')->cascadeOnDelete();
            $table->string('status')->default('Draft'); // Draft, Pending Budget Review, Approved, Returned
            $table->string('type')->default('Indicative'); // Indicative, Final
            $table->boolean('is_cse')->default(false)->index();
            $table->text('remarks')->nullable();
            $table->timestamps();
        });

        // 4. Indicative PPMP
        Schema::create('indicative_ppmp', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->integer('fiscal_year')->index();
            $table->foreignId('office_id')->constrained('offices')->cascadeOnDelete();
            $table->string('status')->default('Draft');
            $table->string('type')->default('Indicative');
            $table->string('posting_status')->default('Draft'); // Draft, Posted, Approved, Rejected
            $table->timestamp('posted_at')->nullable();
            $table->foreignId('posted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('market_scoping_docs')->nullable();
            $table->double('life_cycle_costing')->default(0.0);
            $table->text('rejection_remarks')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('remarks')->nullable();
            $table->string('spreadsheet_id')->nullable()->index();
            $table->timestamps();
        });

        // 5. Final PPMP
        Schema::create('final_ppmp', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->integer('fiscal_year')->index();
            $table->foreignId('office_id')->constrained('offices')->cascadeOnDelete();
            $table->string('status')->default('Draft');
            $table->string('type')->default('Final');
            $table->string('approval_status')->default('Draft'); // Draft, Submitted, Approved, Rejected
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('verification_notes')->nullable();
            $table->text('remarks')->nullable();
            $table->integer('version')->default(1);
            $table->timestamps();

            $table->unique(['office_id', 'fiscal_year', 'version'], 'uq_final_ppmp_office_fy_version');
        });

        // 6. PPMP Items
        Schema::create('ppmp_item', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ppmp_id')->nullable()->constrained('ppmp')->cascadeOnDelete();
            $table->foreignId('indicative_ppmp_id')->nullable()->constrained('indicative_ppmp')->cascadeOnDelete();
            $table->integer('sheet_row_id')->nullable();
            $table->text('description');
            $table->string('project_type')->nullable();
            $table->string('quantity_size')->nullable();
            $table->boolean('is_cse')->default(false);
            $table->string('procurement_mode')->default('Competitive Bidding');
            $table->boolean('pre_proc_conf')->default(false);
            $table->string('proc_start')->nullable();
            $table->string('proc_end')->nullable();
            $table->string('delivery_period')->nullable();
            $table->string('fund_source')->nullable();
            $table->double('estimated_budget')->default(0.0);
            $table->text('supporting_docs')->nullable();
            $table->text('remarks')->nullable();
            $table->string('category')->nullable();
            $table->integer('quantity')->nullable();
            $table->string('unit_of_measure')->nullable();
            $table->double('unit_cost')->nullable();
            $table->integer('q1_qty')->default(0);
            $table->integer('q2_qty')->default(0);
            $table->integer('q3_qty')->default(0);
            $table->integer('q4_qty')->default(0);
            $table->timestamps();
        });

        // 7. Consolidated APP
        Schema::create('app', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->integer('fiscal_year')->unique()->index();
            $table->string('status')->default('Draft'); // Draft, Approved
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        // 8. APP Rows
        Schema::create('approw', function (Blueprint $table) {
            $table->id();
            $table->foreignId('app_id')->constrained('app')->cascadeOnDelete();
            $table->text('description');
            $table->boolean('is_cse')->default(false);
            $table->string('project_type')->nullable();
            $table->string('procurement_mode');
            $table->string('fund_source')->nullable();
            $table->string('quantity_size')->nullable();
            $table->string('proc_start')->nullable();
            $table->string('proc_end')->nullable();
            $table->string('delivery_period')->nullable();
            $table->boolean('pre_proc_conf')->default(false);
            $table->double('total_estimated_budget')->default(0.0);
            $table->text('end_user_offices')->nullable();
            $table->string('category')->nullable();
            $table->integer('total_quantity')->nullable();
            $table->string('unit_of_measure')->nullable();
            $table->double('unit_cost')->nullable();
            $table->integer('q1_qty')->default(0);
            $table->integer('q2_qty')->default(0);
            $table->integer('q3_qty')->default(0);
            $table->integer('q4_qty')->default(0);
            $table->timestamps();
        });

        // 9. DBM Classification
        Schema::create('dbm_classification', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('project_title');
            $table->string('classification');
            $table->timestamps();
        });

        // 10. CSE Catalog Item
        Schema::create('cse_catalog_item', function (Blueprint $table) {
            $table->id();
            $table->string('code')->default('')->index();
            $table->string('description', 500)->index();
            $table->string('unit_of_measure')->default('piece');
            $table->string('category')->default('Common-Use Supplies and Equipment')->index();
            $table->boolean('is_cse')->default(true);
            $table->string('source')->nullable();
            $table->timestamps();
        });

        // 11. APP Signatory
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

        // 12. Sync Logs & Processed Rows
        Schema::create('sync_log', function (Blueprint $table) {
            $table->id();
            $table->timestamp('ran_at')->useCurrent();
            $table->boolean('success');
            $table->integer('files_processed')->default(0);
            $table->text('message')->nullable();
            $table->timestamps();
        });

        Schema::create('processed_row', function (Blueprint $table) {
            $table->id();
            $table->string('source_file');
            $table->text('row_data');
            $table->timestamp('imported_at')->useCurrent();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('processed_row');
        Schema::dropIfExists('sync_log');
        Schema::dropIfExists('app_signatory');
        Schema::dropIfExists('cse_catalog_item');
        Schema::dropIfExists('dbm_classification');
        Schema::dropIfExists('approw');
        Schema::dropIfExists('app');
        Schema::dropIfExists('ppmp_item');
        Schema::dropIfExists('final_ppmp');
        Schema::dropIfExists('indicative_ppmp');
        Schema::dropIfExists('ppmp');
        Schema::dropIfExists('users');
        Schema::dropIfExists('offices');
    }
};
