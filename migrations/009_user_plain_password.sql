-- BAC admin display copy of passwords set at create/reset.
-- Login still uses hashed_password; existing rows stay NULL until password is reset.
ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS plain_password VARCHAR;
