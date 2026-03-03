# ProjectM Cutover Notes

## Current state
- New app architecture exists as a parallel build in:
  - `apps/web` (React + Tailwind + Framer Motion)
  - `apps/api` (Express + Prisma + PostgreSQL)
  - `packages/contracts` (shared Zod contracts)
- Legacy content is available at `/legacy/*`.

## Cutover sequence
1. Deploy `apps/api` with PostgreSQL and run migrations.
2. Deploy `apps/web` as the root frontend (`/`).
3. Keep old pages mounted under `/legacy/*`.
4. Validate route health and booking submit regressions.
5. Activate DNS/CDN cache invalidation for root.

## Production checklist
- Configure Twilio/Stripe/Zoom sandbox credentials.
- Enable HTTPS and secure cookies.
- Enable Sentry and metrics scraping.
- Run backup/restore drill for PostgreSQL.
- Confirm all support channel labels include external-warning text.
