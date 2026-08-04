# Ghostinc Agent Notes

## Start Here

- Executable config wins over prose: both `package.json` files, lockfiles, `compose*.yaml`, and `.github/workflows/` are authoritative.
- Execute only tasks marked `READY` in `docs/AGENT-TASKS.md`. Read the linked task, `docs/ARCHITECTURE.md`, and `docs/SECURITY-ROADMAP.md`; mark it `DONE` and update `docs/BACKLOG.md` only after every acceptance check passes.
- Read `docs/MERCADO-PAGO.md` before billing work. Never invent prices, taxes, refunds, retention, credentials, or deployment details.
- Native auth is defined by `docs/AUTH-NATIVE.md`; `docs/AUTH0.md` is retired evidence, not operational guidance.

## Package Boundaries

- Root is Next.js 16/React 19. App and browser BFF routes live under `src/app/`; there is no Next middleware/proxy.
- `backend/` is an independent Fastify ESM package with its own lockfile and entrypoints `backend/src/server.ts` and `backend/src/app.ts`.
- Backend uses `moduleResolution: NodeNext`; relative TypeScript imports require `.js` suffixes.
- Update each lockfile only via npm in its package. Never edit or stage `node_modules/`, `.next/`, `backend/dist/`, or `*.tsbuildinfo`.
- Next uses `output: "standalone"`; the runtime image copies `.next/standalone`, not source files.

## Verification

- CI and Docker use Node 22. There is no lint or formatter script; do not claim lint passed.
- Frontend, from root: `npm ci && npm run typecheck && npm run build && npm test`.
- Focused frontend: `npm test -- src/app/api/auth/login/route.test.ts` (Vitest defaults to Node; add `// @vitest-environment jsdom` for DOM component tests).
- Backend tests refuse any database whose name does not contain `test`. Start it from root with `docker compose up -d postgres-test`.
- Backend, from `backend/`, follows CI order: `npm ci`, `npm run typecheck`, `DATABASE_URL=postgresql://ghostinc:ghostinc_test@127.0.0.1:55432/ghostinc_test npm run migrate`, `TEST_DATABASE_URL=postgresql://ghostinc:ghostinc_test@127.0.0.1:55432/ghostinc_test npm test`, `npm run build`.
- Focused backend: `TEST_DATABASE_URL=postgresql://ghostinc:ghostinc_test@127.0.0.1:55432/ghostinc_test npx tsx --test --test-concurrency=1 test/admin.test.ts`.
- Infrastructure: `docker compose config --quiet` and `docker compose --env-file .env.production.example -f compose.production.yaml config --quiet`.
- Full local integration: `docker compose up -d --build`, then `docker compose ps` and `curl http://localhost:4000/health/ready`.

## Runtime and Data

- Local frontend is `http://localhost:3002`, backend `http://localhost:4000`, and test PostgreSQL `127.0.0.1:55432`; primary PostgreSQL is not host-published. PJUD defaults to `host.docker.internal:18080`.
- Containers run ordered migrations before backend startup. Add a new file under `backend/migrations/`; never edit an applied migration.
- Do not run `docker compose down -v` unless deleting local data is intentional.
- Root `.env` contains real local secrets and is mode 600. Never print, stage, log, or copy it; only `.env.example` files are tracked.
- Browser free search is `POST /api/causas` -> `POST /internal/v1/causas/search`; never publish `/internal/*`.
- Free search fixes `estado=abiertas`, `participacion=demandado`, and `limit=10` server-side. Do not accept browser overrides or place RUT/name queries in URLs or logs.
- Paid API reserves one credit before PJUD and compensates provider failures. Preserve atomic balances, immutable ledger rows, idempotency, compensating entries, and HMAC-only API key storage.

## Authentication

- Fastify is the identity authority and sole owner of auth tables. Next is a BFF and must not query PostgreSQL or expose `/internal/auth/*`.
- Registration/recovery tokens are single-use, 30-minute, hash-only values. Email links keep tokens in the URL fragment; never move them to query strings, SSR, logs, or browser storage.
- Passwords are Argon2id PHC strings. Password changes, token consumption, and session revocation remain transactional.
- Sessions are opaque, hashed, rotated, and revocable. Production uses `__Host-id` (Secure, HttpOnly, SameSite=Strict). Every BFF mutation requires exact-origin validation plus `X-Ghostinc-Request: 1`.
- Every admin page and Server Action calls `requireAdmin`; Fastify admin reads/writes also require an admin session with recent MFA, not only `INTERNAL_SERVICE_TOKEN`.
- Admin bootstrap creates only the first new identity. Later invitations/roles go through `/admin`; admin mutations are audited and must not remove the last active admin.
- Admins require TOTP; users may enable it only with explicit password reauthentication. Auth0 runtime was retired in IAM-008; do not reintroduce it.

## Billing and Deployment

- Initial billing is one-off, non-expiring prepaid CLP credits via Mercado Pago Checkout Pro. The browser submits only a package ID; immutable server snapshots own price, currency, and credits. Credit only after a signature-valid webhook plus provider lookup.
- Images, actions, and base images are pinned; runtime images intentionally omit npm/corepack/yarn. Read `docs/SUPPLY-CHAIN.md` before CI or Docker changes.
- Pushes to `main` verify, scan, publish multi-arch images, emit SPDX/provenance, and sign GHCR digests; they do not deploy. Deployment requires manual `workflow_dispatch` with `deploy=true` and Cosign verification.
- Before OCI work, read gitignored `docs/OCI-SERVER.local.md`. The shared host already owns 80/443 with Nginx; never run `compose.production.yaml` there unchanged or expose PostgreSQL, backend, or internal routes.
- Production accepts immutable `FRONTEND_IMAGE`/`BACKEND_IMAGE` digest references only; never deploy `latest`.
