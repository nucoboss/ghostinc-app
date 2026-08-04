-- IAM-002: cuentas individuales.
-- api_keys, créditos, consumo y facturación pasan a pertenecer al usuario.
-- organizations y memberships se retiran del esquema.

ALTER TABLE users
  ADD COLUMN credit_balance integer NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE api_keys
  ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE credit_ledger
  ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE api_requests
  ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE billing_events
  ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- Backfill: cada registro histórico se asigna al propietario de su organización
-- (fallback al primer miembro si no existe un rol 'owner').
WITH owner AS (
  SELECT DISTINCT ON (m.organization_id)
         m.organization_id,
         m.user_id
  FROM memberships m
  ORDER BY m.organization_id,
           CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END,
           m.created_at
)
UPDATE api_keys k
SET user_id = owner.user_id
FROM owner
WHERE owner.organization_id = k.organization_id
  AND k.user_id IS NULL;

-- Registros sin propietario posible (organización sin membresía) se descartan:
-- el modelo nuevo exige user_id y no existen datos reales en el momento del corte.
DELETE FROM api_keys k
WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = k.organization_id);

WITH owner AS (
  SELECT DISTINCT ON (m.organization_id)
         m.organization_id,
         m.user_id
  FROM memberships m
  ORDER BY m.organization_id,
           CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END,
           m.created_at
)
UPDATE credit_ledger l
SET user_id = owner.user_id
FROM owner
WHERE owner.organization_id = l.organization_id
  AND l.user_id IS NULL;

DELETE FROM credit_ledger l
WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = l.organization_id);

WITH owner AS (
  SELECT DISTINCT ON (m.organization_id)
         m.organization_id,
         m.user_id
  FROM memberships m
  ORDER BY m.organization_id,
           CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END,
           m.created_at
)
UPDATE api_requests r
SET user_id = owner.user_id
FROM owner
WHERE owner.organization_id = r.organization_id
  AND r.user_id IS NULL;

DELETE FROM api_requests r
WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = r.organization_id);

WITH owner AS (
  SELECT DISTINCT ON (m.organization_id)
         m.organization_id,
         m.user_id
  FROM memberships m
  ORDER BY m.organization_id,
           CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END,
           m.created_at
)
UPDATE billing_events b
SET user_id = owner.user_id
FROM owner
WHERE owner.organization_id = b.organization_id
  AND b.user_id IS NULL;

DELETE FROM billing_events b
WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = b.organization_id);

-- Los saldos de organización migran a los usuarios propietarios.
UPDATE users u
SET credit_balance = COALESCE((
  SELECT sum(o.credit_balance)
  FROM organizations o
  JOIN memberships m ON m.organization_id = o.id AND m.user_id = u.id
), 0)
WHERE EXISTS (
  SELECT 1
  FROM organizations o
  JOIN memberships m ON m.organization_id = o.id AND m.user_id = u.id
);

ALTER TABLE api_keys ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE credit_ledger ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE api_requests ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE billing_events ALTER COLUMN user_id SET NOT NULL;

DROP INDEX api_keys_organization_idx;
CREATE INDEX api_keys_user_idx ON api_keys(user_id);

DROP INDEX credit_ledger_organization_created_idx;
CREATE INDEX credit_ledger_user_created_idx ON credit_ledger(user_id, created_at DESC);

DROP INDEX api_requests_organization_created_idx;
CREATE INDEX api_requests_user_created_idx ON api_requests(user_id, created_at DESC);

ALTER TABLE api_keys DROP COLUMN organization_id;
ALTER TABLE credit_ledger DROP COLUMN organization_id;
ALTER TABLE api_requests DROP COLUMN organization_id;
ALTER TABLE billing_events DROP COLUMN organization_id;

DROP TABLE memberships;
DROP TABLE organizations;
