# Ghostinc Agent Notes

## Start Here

- Executable config wins over prose: root and `backend/package.json`, lockfiles, `compose*.yaml`, and `.github/workflows/` are authoritative.
- Work only on tasks marked `READY` in `docs/AGENT-TASKS.md`. Read the linked task plus `docs/ARCHITECTURE.md` and `docs/SECURITY-ROADMAP.md`; update the task, queue, and `docs/BACKLOG.md` only after all acceptance checks pass.
- Read `docs/MERCADO-PAGO.md` before billing work. Never invent prices, taxes, refunds, retention policy, credentials, or deployment details.
- `README.md` still contains historical Auth0 wording. Native-auth status is defined by `docs/AUTH-NATIVE.md` and tasks `IAM-003` through `IAM-008`.

## Packages and Entrypoints

- Root is Next.js 16/React 19 plus browser BFF routes under `src/app/api/`; app entrypoints are `src/app/`. There is no Next middleware/proxy currently.
- `backend/` is an independent Fastify ESM package with its own lockfile. Entrypoints are `backend/src/server.ts` and `backend/src/app.ts`.
- Backend uses `moduleResolution: NodeNext`; relative TypeScript imports must include `.js`.
- Never edit or stage `node_modules/`, `.next/`, `backend/dist/`, or `*.tsbuildinfo`. Update each package's lockfile only through npm in that package.
- Next uses `output: "standalone"`; Docker copies `.next/standalone`, not the source tree.

## Verification

- CI/Docker target Node 22 even if the host runs another version. There is no lint/formatter script; do not claim lint passed.
- Frontend CI order from repo root: `npm ci && npm run typecheck && npm run build && npm test`.
- Focused frontend test: `npm test -- src/app/api/auth/login/route.test.ts`.
- Backend tests require a PostgreSQL database whose name contains `test`; the guard rejects any other database name.
- Start the backend test database from repo root: `docker compose up -d postgres-test`.
- Then from `backend/`: run migration, typecheck, tests, and build in that order:
  `DATABASE_URL=postgresql://ghostinc:ghostinc_test@127.0.0.1:55432/ghostinc_test npm run migrate`, `npm run typecheck`, `TEST_DATABASE_URL=postgresql://ghostinc:ghostinc_test@127.0.0.1:55432/ghostinc_test npm test`, `npm run build`.
- Focused backend test from `backend/`: `TEST_DATABASE_URL=postgresql://ghostinc:ghostinc_test@127.0.0.1:55432/ghostinc_test npx tsx --test --test-concurrency=1 test/auth-tokens.test.ts`.
- Infrastructure: `docker compose config --quiet` and `docker compose --env-file .env.production.example -f compose.production.yaml config --quiet`.
- Full local integration: `docker compose up -d --build`, then `docker compose ps` and `curl http://localhost:4000/health/ready`.

## Local Runtime

- Frontend is `http://localhost:3002`; backend is `http://localhost:4000`; test PostgreSQL is published only at `127.0.0.1:55432`. Primary PostgreSQL is not host-published.
- PJUD defaults to `host.docker.internal:18080`; override `PJUD_API_BASE_URL` when the upstream is elsewhere.
- Containers apply ordered migrations before backend startup. Add a new SQL file under `backend/migrations/`; never alter an applied migration.
- Do not run `docker compose down -v` unless local database deletion is intentional.
- Root `.env` contains real local secrets and is mode 600. Never print, stage, log, or copy it; only `.env.example` files are tracked.

## API and Data Invariants

- Browser free search is `POST /api/causas` -> `POST /internal/v1/causas/search`; Caddy must never publish `/internal/*`.
- Free search fixes `estado=abiertas`, `participacion=demandado`, and `limit=10` server-side. Do not accept browser overrides or put RUT/name queries in URLs/logs.
- Paid API is `GET /api/v1/causas/rut/:rut` with `X-API-Key`. Current code reserves one credit before PJUD and compensates provider failures; target pagination/billing semantics are documented in `docs/API.md` and task files.
- Preserve atomic balances, immutable ledger rows, idempotent retries, and compensating entries. API keys are stored only as HMACs using `API_KEY_PEPPER`.
- PJUD and primary SQL are essential sources; complementary-source failures may return billable partial responses. Preserve source provenance, freshness, normalization, and deduplication.

## Authentication

- Fastify is the identity authority and sole owner of auth tables. Browser traffic goes through Next BFF; Next must not query PostgreSQL or expose `/internal/auth/*`.
- Native registration/recovery uses Resend and single-use 30-minute tokens stored only as hashes. Email links carry tokens in the URL fragment, which the client removes immediately; do not move them to query strings, SSR, logs, or browser storage.
- Passwords are Argon2id PHC strings. Password change/token consumption/session revocation must remain one transaction.
- Sessions are opaque, hashed, server-side, rotated, and revocable. Production cookie is `__Host-id`, Secure, HttpOnly, SameSite=Strict. Every BFF mutation requires exact origin plus `X-Ghostinc-Request: 1`.
- Every admin page and Server Action calls `requireAdmin`; Fastify admin reads/writes also require an admin session, not only `INTERNAL_SERVICE_TOKEN`.
- IAM-007 TOTP is not implemented yet and is blocked on SEC-004. Do not imply admin MFA is active.
- Auth0 code remains only for the IAM-008 cutover; do not add new Auth0 behavior or remove legacy files outside that task.

## Billing

- Initial product is one-off, non-expiring prepaid CLP credits through Mercado Pago Checkout Pro. The browser submits only a package ID; price/currency/credits come from an immutable server snapshot.
- Credit only after signature-validated webhook plus provider payment lookup. Return URLs are display-only; retries must not duplicate ledger entries.

## Supply Chain and Deployment

- Images/actions/base images are pinned; runtime images intentionally omit npm/corepack/yarn. Production uses read-only roots, `no-new-privileges`, tmpfs, and resource limits. See `docs/SUPPLY-CHAIN.md` before changing CI or Docker.
- Pushes to `main` build, scan, publish multi-arch (`amd64`,`arm64`), emit SPDX SBOM/provenance, and sign GHCR digests. They do not deploy. OCI deploy requires manual `workflow_dispatch` with `deploy=true` and verifies Cosign signatures first.
- Before any OCI operation, read gitignored `docs/OCI-SERVER.local.md`. The shared host already has Nginx on 80/443; never run `compose.production.yaml` there unchanged or expose PostgreSQL/backend/internal routes.
- Production consumes immutable `FRONTEND_IMAGE`/`BACKEND_IMAGE` digest references. Never deploy `latest`.

## Current Handoff

- Git is initialized on `main`; `origin` is `https://github.com/nucoboss/ghostinc-app.git`, currently empty. The initial tree is staged but no commit/push has been authorized.
- Staged content passed TruffleHog with zero findings; `.env`, local invoice PDFs, generated dist/cache files are ignored. Recheck `git status`, staged diff, secret scan, and user authorization before the initial commit/push.
- `SEC-003` remains `BLOCKED` until the first push proves CI, GHCR SBOMs, ARM64 manifests, and Cosign OIDC signatures. OCI preparation/deployment is a later explicit step.
