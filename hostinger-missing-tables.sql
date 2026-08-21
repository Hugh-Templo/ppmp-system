-- Missing Hostinger tables that already exist on local appbac
-- phpMyAdmin: select database u951669574_ppmp, then Import this file
-- Safe to re-run (IF NOT EXISTS / INSERT IGNORE)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. APP Signatory (BAC admin Save APP Signatory)
CREATE TABLE IF NOT EXISTS `app_signatory` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `prepared_by` varchar(255) DEFAULT NULL,
  `prepared_by_designation` varchar(255) DEFAULT NULL,
  `recommended_by` varchar(255) DEFAULT NULL,
  `recommended_by_designation` varchar(255) DEFAULT NULL,
  `approved_by_name` varchar(255) DEFAULT NULL,
  `approved_by_designation` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `app_signatory`
  (`id`, `prepared_by`, `prepared_by_designation`, `recommended_by`, `recommended_by_designation`, `approved_by_name`, `approved_by_designation`, `created_at`, `updated_at`)
VALUES
  (1, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());

-- 2. Office notifications (push notices; deadline is optional)
CREATE TABLE IF NOT EXISTS `office_notifications` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `fiscal_year` smallint(5) UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `deadline_at` date DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `emailed_at` timestamp NULL DEFAULT NULL,
  `emails_queued` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `office_notifications_created_by_foreign` (`created_by`),
  KEY `office_notifications_fiscal_year_index` (`fiscal_year`),
  KEY `office_notifications_deadline_at_index` (`deadline_at`),
  KEY `office_notifications_status_index` (`status`),
  CONSTRAINT `office_notifications_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- If the table already existed with a required deadline, make it optional
ALTER TABLE `office_notifications` MODIFY `deadline_at` date DEFAULT NULL;

-- 3. Mail send batches (Resend quota tracking)
CREATE TABLE IF NOT EXISTS `mail_send_batches` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `channel` varchar(50) NOT NULL DEFAULT 'office_notification',
  `reference_id` bigint(20) UNSIGNED DEFAULT NULL,
  `emails_queued` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `mail_send_batches_channel_index` (`channel`),
  KEY `mail_send_batches_reference_id_index` (`reference_id`),
  KEY `mail_send_batches_created_at_index` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Login monitor
CREATE TABLE IF NOT EXISTS `system_login_logs` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `success` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `system_login_logs_user_id_foreign` (`user_id`),
  KEY `system_login_logs_username_index` (`username`),
  KEY `system_login_logs_success_index` (`success`),
  KEY `system_login_logs_created_at_index` (`created_at`),
  CONSTRAINT `system_login_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. API activity monitor
CREATE TABLE IF NOT EXISTS `system_activity_logs` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `method` varchar(10) NOT NULL,
  `path` varchar(500) NOT NULL,
  `status_code` smallint(5) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `duration_ms` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `system_activity_logs_user_id_foreign` (`user_id`),
  KEY `system_activity_logs_username_index` (`username`),
  KEY `system_activity_logs_created_at_index` (`created_at`),
  CONSTRAINT `system_activity_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Maintenance mode
CREATE TABLE IF NOT EXISTS `system_maintenance` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `message` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `system_maintenance_is_enabled_index` (`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `system_maintenance` (`id`, `is_enabled`, `message`, `created_at`, `updated_at`)
VALUES (1, 0, NULL, NOW(), NOW());

-- Record these as already migrated so artisan migrate will not recreate them later
INSERT INTO `migrations` (`migration`, `batch`)
SELECT v.migration, 10
FROM (
  SELECT '2026_08_14_000001_create_system_monitor_logs' AS migration
  UNION ALL SELECT '2026_08_19_000001_create_office_notifications_table'
  UNION ALL SELECT '2026_08_19_000002_add_emails_queued_to_office_notifications'
  UNION ALL SELECT '2026_08_19_000003_create_mail_send_batches_table'
  UNION ALL SELECT '2026_08_20_000001_ensure_app_signatory_table'
  UNION ALL SELECT '2026_08_20_000002_create_system_maintenance_table'
  UNION ALL SELECT '2026_08_20_000002_make_office_notification_deadline_nullable'
) AS v
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations` m WHERE m.migration = v.migration
);

SET FOREIGN_KEY_CHECKS = 1;
