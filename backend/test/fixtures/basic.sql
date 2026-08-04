-- Fixture mínimo para bases de prueba (DB-001).
-- Solo datos sintéticos: sin RUT reales, sin direcciones, sin secretos.
-- Los key_hash y correos son ficticios y no corresponden a personas.

INSERT INTO users (email, credit_balance) VALUES
  ('fixture-a@example.test', 10),
  ('fixture-b@example.test', 0);

INSERT INTO api_keys (user_id, name, key_hash, prefix, last_four)
SELECT u.id, 'clave fixture', 'fixture-key-hash-a', 'pjud', 'f1A2'
FROM users u
WHERE u.email = 'fixture-a@example.test';

INSERT INTO credit_ledger (user_id, delta, reason)
SELECT u.id, 10, 'fixture'
FROM users u
WHERE u.email = 'fixture-a@example.test';
