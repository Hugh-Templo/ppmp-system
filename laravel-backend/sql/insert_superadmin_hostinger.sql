-- ============================================================
-- Hostinger: insert / update SUPERADMIN monitor account
-- ============================================================
-- How to use (phpMyAdmin):
--   1. Open your app database
--   2. Go to SQL tab
--   3. Paste this script and click Go
--
-- Login credentials (CHANGE AFTER FIRST LOGIN):
--   Username: SUPERADMIN
--   Password: SuperAdmin@2026!
--
-- Role: super_admin (System Monitor only — not BAC/Budget screens)
-- ============================================================

-- Optional: create monitoring tables if migrations were not run yet
CREATE TABLE IF NOT EXISTS `system_login_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `success` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `system_login_logs_username_index` (`username`),
  KEY `system_login_logs_success_index` (`success`),
  KEY `system_login_logs_created_at_index` (`created_at`),
  KEY `system_login_logs_user_id_foreign` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `system_activity_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `method` varchar(10) NOT NULL,
  `path` varchar(500) NOT NULL,
  `status_code` smallint unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `duration_ms` int unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `system_activity_logs_username_index` (`username`),
  KEY `system_activity_logs_created_at_index` (`created_at`),
  KEY `system_activity_logs_user_id_foreign` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (
  `username`,
  `email`,
  `hashed_password`,
  `is_active`,
  `role`,
  `office_id`,
  `created_at`,
  `updated_at`
) VALUES (
  'SUPERADMIN',
  'superadmin@ormoc.gov.ph',
  '$2y$12$XO5zj.3EUuLi0JThbwjWXuV0XRwWlvIJBiKF0co0IAY9HMwVJuTZC',
  1,
  'super_admin',
  NULL,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  `email` = VALUES(`email`),
  `hashed_password` = VALUES(`hashed_password`),
  `is_active` = 1,
  `role` = 'super_admin',
  `office_id` = NULL,
  `updated_at` = NOW();

-- Verify:
-- SELECT id, username, email, role, is_active FROM users WHERE username = 'SUPERADMIN';
