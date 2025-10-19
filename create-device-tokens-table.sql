-- SQL script to create device_tokens table manually
-- Run this on your production database if the table doesn't exist

CREATE TABLE IF NOT EXISTS `device_tokens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `device_token` VARCHAR(500) NOT NULL,
  `platform` ENUM('ios', 'android', 'web') NOT NULL DEFAULT 'android',
  `device_name` VARCHAR(255) DEFAULT NULL,
  `app_version` VARCHAR(50) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_used_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_token` (`device_token`),
  KEY `device_tokens_user_id` (`user_id`),
  KEY `device_tokens_is_active` (`is_active`),
  KEY `device_tokens_last_used_at` (`last_used_at`),
  CONSTRAINT `device_tokens_user_id_foreign` 
    FOREIGN KEY (`user_id`) 
    REFERENCES `users` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS `idx_device_tokens_user_active` ON `device_tokens` (`user_id`, `is_active`);

SELECT 'Device tokens table created successfully!' as message;

