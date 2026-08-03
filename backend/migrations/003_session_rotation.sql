ALTER TABLE auth_sessions
  ADD COLUMN rotated_at timestamptz NOT NULL DEFAULT now();
