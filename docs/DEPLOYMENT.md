# Production deployment

Set `APP_ORIGIN` to the exact public HTTPS origin, `DATABASE_URL` to a TLS PostgreSQL connection string, and `SESSION_SECRET` to a unique 32+ character secret held only in the deployment secret manager. The session cookie is `HttpOnly`, `SameSite=Lax`, and marked `Secure` whenever `APP_ORIGIN` is HTTPS.

Install with the existing lockfile and package manager: `bun install --frozen-lockfile`. The application is pinned to Nitro's `vercel` preset and should be imported into Vercel as a Git project with Build Command `bun run build`; Vercel serves its generated serverless output. `bun run start` remains for local Node verification only. The minimal unauthenticated health endpoint is `GET /health` and returns only `{ "status": "ok" }`.

For Neon, use its pooled TLS URL as `DATABASE_URL` for Vercel runtime queries. The runtime client disables named prepared statements so it is compatible with transaction pooling. Prefer a separate direct TLS URL as `MIGRATION_DATABASE_URL` for `bun run migrate` and provisioning, because schema operations should not depend on the runtime pooler. The scripts fall back to `DATABASE_URL` only when a direct URL is unavailable. Before serving private routes, run `bun run migrate` against a new dedicated Neon database. It records applied migrations in `platform_migrations`; do not reset schema or edit an already-applied migration.

## Manual Neon migrations through GitHub Actions

The repository includes a manual-only `Migrate Neon database` workflow. It never runs on push. Before dispatching it, add the direct TLS connection string as the repository or protected-environment secret `MIGRATION_DATABASE_URL`; do not add that value to workflow files or Vercel.

When dispatching the workflow, enter the exact target database name (the database portion of the direct URL) and type `APPLY` as the confirmation. The workflow uses the pinned Bun release in `.bun-version` and `bun.lock`, resolves the Neon hostname, enforces TLS, verifies that `current_database()` equals the supplied name, applies only unapplied versioned migrations, then verifies the migration ledger and expected platform tables. It deliberately emits no connection string, password, or host name.

For the current production URL, configure these **Production** Vercel variables before redeploying: `DATABASE_URL` (pooled Neon TLS URL), `SESSION_SECRET` (a unique secret of at least 32 characters), and `APP_ORIGIN=https://campus-scouts.vercel.app`. Keep `MIGRATION_DATABASE_URL` in GitHub Actions only. Do not provision an administrator until migrations succeed; provisioning requires a legitimate `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` supplied through a secret manager.

Provision the first administrator once with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` passed only through the hosting secret manager, then run `bun run provision:admin`. It refuses to replace an existing account. Never deploy default credentials or invitation tokens.

In Vercel, configure `DATABASE_URL`, `SESSION_SECRET`, and `APP_ORIGIN` separately for Preview and Production. Use the Preview deployment URL as `APP_ORIGIN` for preview validation, then the exact custom HTTPS domain for Production. Run migrations and initial admin provisioning outside Vercel build steps using the same environment secrets. Post-deploy smoke test: load `/`, submit an invalid public application, authenticate an invited account, verify `/workspace`, and use a separate admin account to verify `/console`. Confirm cookies are Secure over HTTPS and that an unauthenticated request cannot retrieve dashboard server-function data.

Email, object storage, and realtime variables in `.env.example` are interfaces only. Invitations need a configured transactional-email adapter to be delivered; uploads need private object storage; messaging is persisted but not realtime until a realtime provider is configured.
