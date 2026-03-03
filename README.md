# Project Paige / ProjectM Platform

A premium mentorship-first childcare and learning platform founded by Paige, focused on Technology, Business Logic, and Legal Mentorship.

## Product direction
- Family-first, security-first, measurable learning outcomes, effortless booking
- Assignment mechanics inspired by Google Classroom
- Attendance and gradebook mechanics inspired by PowerSchool
- Mentor live timeline inspired by DoorDash
- Community channels: Discord and Instagram (external), with in-app support for account issues

## Monorepo structure
- `apps/web`: React + Tailwind + Framer Motion + React Query + Zustand
- `apps/api`: Express + Prisma + PostgreSQL + REST `/api/v1`
- `packages/contracts`: Shared Zod contracts and DTO schemas
- `legacy`: archived static content served at `/legacy/*`

## Product surfaces
- Public booking website: `/`, `/book`, `/tiers`, `/support`
- Owner workspace: `/workspace` (OWNER, MANAGER, MEDIUM, MONITOR, ADMIN)
- Client workspace: `/client` (CLIENT role)
- Parent workspace: `/parent` (FAMILY/PARENT roles)
- Diagnostic workspace: `/diagnostic` (authenticated student/family/mentor/admin view, with admin/proctor controls)

## Quick start
1. Copy `.env.example` to `.env` and update secrets.
2. Start infra:
   - `docker compose up -d`
3. Install deps:
   - `npm install`
4. Generate Prisma client and migrate:
   - `npm run db:generate`
   - `npm run db:migrate`
   - `npm run db:seed`
5. Run apps:
   - `npm run dev`

## Open The Website (simple)
1. Open terminal in `/Users/maximus/Desktop/ProjectEm`.
2. Install dependencies:
   - `npm install`
3. Make sure PostgreSQL is running on `localhost:5432` and database `projectm` exists.
4. Prepare database:
   - `npm run db:generate`
   - `npm run db:migrate`
   - `npm run db:seed`
5. Start frontend and backend:
   - `npm run dev`
6. Open:
   - `http://localhost:5173` (website)
   - `http://localhost:4000/api/v1/health` (API health)

## URLs you will use
- Public landing page: `/`
- Booking website: `/book`
- Diagnostic testing: `/diagnostic`
- Sign up: `/register`
- Sign in: `/login`
- Owner/Admin workspace: `/workspace`
- Client workspace: `/client`
- Parent workspace: `/parent`

## PWA / App mode
- The web app now supports installable PWA mode.
- Open the site in browser and click `Install App` in the top nav when available.
- Service worker: `apps/web/public/sw.js`
- Manifest: `apps/web/public/manifest.webmanifest`
- App icons are now shipped in `apps/web/public/icons` with valid `192x192` and `512x512` (including maskable icons).

## Google Play Store readiness (Android)
- Android wrapper config: `apps/web/capacitor.config.ts`
- Production web env template: `apps/web/.env.production.example`
- Full guide: `docs/GOOGLE_PLAY_RELEASE.md`

Common commands (from repo root):
- `npm run android:add` (first-time Android project generation)
- `npm run android:sync` (build web + sync Android assets)
- `npm run android:open` (open Android Studio project)
- `npm run android:bundle` (produce release `.aab`)

## Seed login accounts
All seeded accounts use the password from `BOOTSTRAP_ADMIN_PASSWORD` (default: `ChangeThisPassword123!`).

- Owner: `owner@projectm.local`
- Manager: `manager@projectm.local`
- Medium: `medium@projectm.local`
- Monitor: `monitor@projectm.local`
- Client: `client@projectm.local`

Parent accounts are created through `/register` and default to `FAMILY` role.

## Where is the HTML?
- React entry HTML file: `apps/web/index.html`
- Main app shell/layout: `apps/web/src/components/AppShell.tsx`
- Home page content: `apps/web/src/pages/HomePage.tsx`

## Galaxy background video
- Active video file: `apps/web/public/media/galaxy-loop.mp4`
- To replace with your file:
  - `cp "/Users/maximus/Downloads/vecteezy_seamless-loop-galaxy-exploration-through-outer-space-towards_23887107.mp4" "/Users/maximus/Desktop/ProjectEm/apps/web/public/media/galaxy-loop.mp4"`

## API base
- `http://localhost:4000/api/v1`

## Diagnostic API (new)
- Runtime actions: `POST /diagnostic/runtime`
- Child test assignments:
  - `GET /diagnostic/assignments`
  - `POST /diagnostic/admin/assign-child`
- Student summary text: `GET /diagnostic/attempts/:attemptCode/results-summary`
- Proctor/admin attempt view: `GET /diagnostic/admin/attempts/:attemptCode`
- Admin actions:
  - `POST /diagnostic/admin/attempts/:attemptCode/reassign`
  - `POST /diagnostic/admin/attempts/:attemptCode/mark_reviewed`
  - `POST /diagnostic/admin/attempts/:attemptCode/send_parent_report`
  - `POST /diagnostic/admin/attempts/:attemptCode/lock_student`

## Key implemented endpoints
- Auth: `/auth/register`, `/auth/login`, `/auth/webauthn/*`, `/auth/2fa/verify`, `/auth/refresh`, `/auth/logout`
- Families: `/families`, `/families/:id/add-parent`, `/families/:id/add-child`, `/families/:id`
- Booking: `/availability`, `/bookings`, `/bookings/:id/cancel`, `/sessions/:id/schedule-zoom`
- Check-in: `/checkin/scan-qr`, `/checkin/verify-code`
- Academics: `/attendance`, `/attendance/mark`, `/children/:id/attendance`, `/gradebook/:classId`, `/gradebook/:classId/entry`
- Messaging: `/conversations/*`
  - Polling-ready DM list/message metadata with unread counts
  - Read receipts: `POST /conversations/:id/read`
- Mentors: `/mentor-applications`, `/mentors/:id/live-status`, `/mentors/:id/status`, `/admin/mentors/:id/approve`
- Admin: `/admin/analytics`, `/admin/pricing`, `/admin/hardware`, `/admin/audit-logs`, `/admin/coupons`, `/admin/access/policy`, `/admin/ip-bans`
- Family/child summary for owner workspace: `/admin/families/children-summary`
- Role management: `/admin/users/:id/role`
- Integrations: `/webhooks/booking-created`, `/webhooks/payment-succeeded`
- Support: `/support/contacts`, `/support/tickets`

## Security baselines scaffolded
- JWT access/refresh token rotation
- argon2id password hashing
- TOTP verification hooks
- passkey endpoint scaffolding
- request-level audit logging
- rate limiting for auth routes
- workspace-hours role enforcement for admin workspace access
- IP-ban enforcement with optional expiry windows

## Role model
- Admin ladder: `OWNER`, `MANAGER`, `MEDIUM`, `MONITOR` (plus legacy `ADMIN`)
- Client role: `CLIENT`
- Mentor role: `MENTOR`
- Family roles: `FAMILY` (plus legacy `PARENT`)
