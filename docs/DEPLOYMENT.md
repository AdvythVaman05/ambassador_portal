# Production deployment

Set `APP_ORIGIN` to the exact public HTTPS origin, `DATABASE_URL` to a TLS PostgreSQL connection string, and `SESSION_SECRET` to a unique 32+ character secret held only in the deployment secret manager. The session cookie is `HttpOnly`, `SameSite=Lax`, and marked `Secure` whenever `APP_ORIGIN` is HTTPS.

Install with the existing lockfile and package manager: `bun install --frozen-lockfile`. The application is pinned to Nitro's Node `node-server` preset. Build with `bun run build`; run the production bundle with `bun run start`; preview locally with `bun run preview`. The minimal unauthenticated health endpoint is `GET /health` and returns only `{ "status": "ok" }`.

Before serving private routes, run `bun run migrate` against a database backup. It records applied migrations in `platform_migrations`; do not reset schema or edit an already-applied migration. Set `DATABASE_URL`, `SESSION_SECRET`, and `APP_ORIGIN` in the hosting environment before invoking it.

Provision the first administrator once with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` passed only through the hosting secret manager, then run `bun run provision:admin`. It refuses to replace an existing account. Never deploy default credentials or invitation tokens.

Post-deploy smoke test: load `/`, submit an invalid public application, authenticate an invited account, verify `/workspace`, and use a separate admin account to verify `/console`. Confirm cookies are Secure over HTTPS and that an unauthenticated request cannot retrieve dashboard server-function data.

Email, object storage, and realtime variables in `.env.example` are interfaces only. Invitations need a configured transactional-email adapter to be delivered; uploads need private object storage; messaging is persisted but not realtime until a realtime provider is configured.
