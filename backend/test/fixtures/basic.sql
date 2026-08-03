-- Fixture mínimo para bases de prueba (DB-001).
-- Solo datos sintéticos: sin RUT reales, sin direcciones, sin secretos.
-- Los key_hash y correos son ficticios y no corresponden a personas.

INSERT INTO organizations (name, credit_balance) VALUES
  ('Org Fixture A', 10),
  ('Org Fixture B', 0);

INSERT INTO users (email, external_auth_id) VALUES
  ('fixture-a@example.test', 'auth0|fixture-a'),
  ('fixture-b@example.test', 'auth0|fixture-b');

INSERT INTO memberships (organization_id, user_id, role)
SELECT o.id, u.id, 'owner'
FROM organizations o, users u
WHERE o.name = 'Org Fixture A' AND u.email = 'fixture-a@example.test';

INSERT INTO api_keys (organization_id, name, key_hash, prefix, last_four)
SELECT o.id, 'clave fixture', 'fixture-key-hash-a', 'pjud', 'f1A2'
FROM organizations o
WHERE o.name = 'Org Fixture A';

INSERT INTO credit_ledger (organization_id, delta, reason)
SELECT o.id, 10, 'fixture'
FROM organizations o
WHERE o.name = 'Org Fixture A';
