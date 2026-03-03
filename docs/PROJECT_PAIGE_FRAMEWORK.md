# Project Paige - Elite Mentorship Childcare (ProjectM Framework)

## Product summary
Project Paige is a premium mentorship-first childcare and learning platform focused on Technology, Business Logic, and Legal Mentorship.

## Experience principles
- Family-first onboarding and operations
- Security-first auth, privacy, and auditability
- Measurable outcomes across attendance, grades, projects, and milestones
- Fast booking with clear status tracking

## Inspirations
- The Hidden Genius Project (origin story and mission alignment)
- Google Classroom (assignments and submissions workflow)
- PowerSchool (attendance and gradebook workflows)
- DoorDash (mentor live status timeline)

## Core capability map

### Accounts and roles
- Roles: `OWNER`, `MANAGER`, `MEDIUM`, `MONITOR`, `ADMIN`, `MENTOR`, `CLIENT`, `FAMILY`, `PARENT`, `CHILD`
- Families support co-parent workflows and child profiles
- Child logins are restricted from payment/admin actions

### Booking and check-in
- Tiers:
  - Premium Genius: `$45/hr`
  - BYOD Mentorship: `$40/hr`
  - Standard Care: `$32/hr`
- Availability lookup and anti-double-booking
- QR and 6-digit verification code check-in
- Booking status lifecycle and timeline

### Academics and assignments
- Class creation and roster enrollment
- Assignment create/publish/unpublish and student submissions
- Attendance marking with bulk workflows
- Weighted grade entry and grade summary calculations

### Admin operations
- Isolated admin surface (`/workspace` and `/admin/*` redirect)
- Coupon system with optional expiration dates
- Role assignment controls
- Workspace-hours policy and IP ban controls
- Audit logs for privileged operations

### Support and community
- In-app support tickets for account-specific issues
- External community channels:
  - Discord: <https://discord.gg/mcny3pxmKS>
  - Instagram: <https://www.instagram.com/maxxforgestudio/>

## Public landing copy requirements
- Headline: `Forge Geniuses - Elite Mentorship-Based Childcare`
- Subhead: `Hands-on technology, business logic, and legal mentorship woven into childcare. Project-based learning, measurable progress, and trusted in-person and virtual sessions.`
- Primary CTA: `Book a Free Intro Session`
- Secondary CTA: `View ProjectM Tiers`
- Privacy callout: `We protect your family's data with end-to-end best practices - encryption, passkeys, audit logs.`
