<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\Office;
use App\Models\User;
use App\Models\AppSignatory;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Create sample offices
        $bac = Office::updateOrCreate(
            ['code' => 'O-BAC'],
            ['name' => 'Bids and Awards Committee', 'budget_allocation' => 500000.0, 'is_active' => true, 'created_at' => now()]
        );

        Office::updateOrCreate(
            ['code' => 'O-BUDGET'],
            ['name' => 'City Budget Office', 'budget_allocation' => 1000000.0, 'is_active' => true, 'created_at' => now()]
        );

        Office::updateOrCreate(
            ['code' => 'O-CHO'],
            ['name' => 'City Health Office', 'budget_allocation' => 750000.0, 'is_active' => true, 'created_at' => now()]
        );

        Office::updateOrCreate(
            ['code' => 'O-GSO'],
            ['name' => 'General Services Office', 'budget_allocation' => 600000.0, 'is_active' => true, 'created_at' => now()]
        );

        Office::updateOrCreate(
            ['code' => 'O-CMO'],
            ['name' => 'City Mayor\'s Office', 'budget_allocation' => 1200000.0, 'is_active' => true, 'created_at' => now()]
        );

        Office::updateOrCreate(
            ['code' => 'IT'],
            ['name' => 'INFORMATION TECHNOLOGY OFFICE', 'budget_allocation' => 500000.0, 'is_active' => true, 'created_at' => now()]
        );

        Office::updateOrCreate(
            ['code' => 'LCR'],
            ['name' => 'Local Civil Registry', 'budget_allocation' => 500000.0, 'is_active' => true, 'created_at' => now()]
        );

        // 2. Create default Admin User
        User::updateOrCreate(
            ['username' => 'admin'],
            [
                'email' => 'admin@ormoc.gov.ph',
                'hashed_password' => Hash::make('admin123'),
                'role' => 'bac_admin',
                'is_active' => true,
            ]
        );

        // 3. Create default Budget Office User
        User::updateOrCreate(
            ['username' => 'budget'],
            [
                'email' => 'budget@ormoc.gov.ph',
                'hashed_password' => Hash::make('budget123'),
                'role' => 'budget_office',
                'is_active' => true,
            ]
        );

        // 4. Create default End User
        User::updateOrCreate(
            ['username' => 'bac_user'],
            [
                'email' => 'bac@ormoc.gov.ph',
                'hashed_password' => Hash::make('user123'),
                'role' => 'end_user',
                'office_id' => $bac->id,
                'is_active' => true,
            ]
        );

        // 5. Superadmin monitor account (not creatable from BAC UI)
        User::updateOrCreate(
            ['username' => 'SUPERADMIN'],
            [
                'email' => 'superadmin@ormoc.gov.ph',
                'hashed_password' => Hash::make('SuperAdmin@2026!'),
                'password_encrypted' => null,
                'role' => 'super_admin',
                'office_id' => null,
                'is_active' => true,
            ]
        );

        // 6. Create default APP Signatory singleton
        AppSignatory::updateOrCreate(
            ['id' => 1],
            [
                'prepared_by' => 'BAC Secretariat',
                'prepared_by_designation' => 'Secretariat Head',
                'recommended_by' => 'BAC Chairperson',
                'recommended_by_designation' => 'Chairperson',
                'approved_by_name' => 'City Mayor',
                'approved_by_designation' => 'Head of Procuring Entity (HoPE)',
            ]
        );
    }
}
