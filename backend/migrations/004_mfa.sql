ALTER TABLE auth_sessions
  DROP CONSTRAINT auth_sessions_auth_level_check,
  ADD CONSTRAINT auth_sessions_auth_level_check
    CHECK (auth_level IN ('password', 'mfa', 'full')),
  ADD COLUMN mfa_verified_at timestamptz,
  ADD COLUMN mfa_failed_attempts integer NOT NULL DEFAULT 0
    CHECK (mfa_failed_attempts >= 0);
