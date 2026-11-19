# AI Work Log

This file records observable AI-assisted project work in chronological order. It is an implementation audit log, not a conversation transcript. It records actions, files, decisions, verification, and blockers; it does not contain private chain-of-thought. Never record passwords, access tokens, connection strings, secret values, or unnecessary personal data here.

## 2026-11-18 — Backend stack and implementation plan update

### User request

- Replace the backend choice of ASP.NET Core/C# with Node.js while retaining MySQL.
- Use the previously selected option: NestJS + TypeORM.
- Create an implementation plan for the CodeIT project.
- Completely remove the ASP.NET Core and SQLite stack.
- Maintain a detailed Markdown record of AI actions.

### Workspace inspection

- Inspected the current authorized workspace at `C:\Users\Carlos\Desktop\CodeIT`.
- The current workspace directory contained no project files at inspection time.
- Previously observed in an earlier task context, but not present in this current workspace: a `Server/Server` .NET 8 scaffold using EF Core SQLite, a generated `codeit.db`, and a root React/Vite frontend. Those artifacts could not be accessed or removed from the current workspace because they were absent here.
- No repository instructions or existing README/architecture plan were available in this current workspace.

### Decisions captured

- Backend plan: Node.js 24 LTS, TypeScript, NestJS, TypeORM, `mysql2`, and MySQL.
- Schema changes use reviewed migrations; automatic schema synchronization is disabled.
- Preserve the approved CodeIT role model, classroom approval flow, learning/assessment rules, idempotent reward ledger, and provider-neutral isolated Java execution boundary.
- Do not execute student code within the API or database host; when no approved sandbox exists, execution remains unavailable rather than running unsafely.
- The frontend remains React/Vite/TypeScript.

### Files created

- `ARCHITECTURE_DELIVERY_PLAN.md` — implementation plan, architecture, database model, API inventory, security workflow, Java execution boundary, delivery phases, and acceptance criteria.
- `AI_WORK_LOG.md` — this chronological action record.

### Removal status

- No ASP.NET Core, C#, EF Core, or SQLite files existed in the current authorized workspace to remove.
- No source files were deleted. The earlier-observed scaffold must be placed in this workspace if the user expects its physical removal from that other location.

### Verification and limitations

- Confirmed the workspace was empty before creating the two Markdown planning files.
- No builds or tests were run because this change only creates planning/audit documentation and there is no code project in this workspace.
- Remaining dependency: availability of the earlier backend scaffold in this workspace before its deletion can be completed and verified.

## 2026-11-18 — Pre-build architecture review and plan refinement

### User request

- Review the architecture/delivery plan for flaws needing fixes or attention.
- Apply the resulting plan recommendations.

### Workspace inspection

- Confirmed the authorized workspace contains the architecture plan and this work log, with no application source, migrations, or repository metadata available for implementation comparison.
- Treated prior implementation details recorded above as historical context, not as additional instructions for this review.

### Decisions recorded

- Quiz participation points are awarded once per student per quiz; challenge participation points are awarded once per student per challenge after the first completed evaluation, including failure. Later attempts remain available for learning but do not repeat participation rewards.
- Promoted Teachers retain their learner profile and can continue personal learning and see their own learner data, but cannot enroll in classrooms while their active role is Teacher.
- Email verification and self-service recovery remain out of v1; email is not accepted as identity proof, and administrator-assisted recovery requires identity checks and audit records.
- Challenge jobs use a transactional outbox, leased worker claims, bounded retries, visible exhausted state, and idempotent requeue.
- Added concrete data-integrity controls for quiz-option ownership, pending requests, active memberships, source-level and content-level rewards, and concurrent attempt caps.
- Set default retention periods of 90 days for source code/detailed runner feedback and 30 days for security logs; educational-record retention follows the institution's approved schedule.
- Clarified authenticated-only content browsing, quiz review/privacy, submission quotas, join-request reapplication, and measurable release/acceptance gates.

### Files updated

- `ARCHITECTURE_DELIVERY_PLAN.md` — incorporated the review decisions in the business rules, schema, APIs, security, execution lifecycle, delivery phases, acceptance criteria, and assumptions.
- `AI_WORK_LOG.md` — recorded this review and the decisions made.

### Verification and limitations

- Reviewed the updated plan and work log text after editing; no builds or tests were run because the workspace contains no application code.
- Retention defaults and administrator-assisted recovery require institutional approval before production. Email verification/recovery, Java runner vendor/hosting/quotas, exact reward values, badge criteria, curriculum format, and due-date rules remain follow-up decisions.

## 2026-11-18 — Project foundation and identity slice

### User request

- Create the CodeIT project based on the approved architecture and reviewed plan.

### Files created

- Root npm workspace, Node 24 runtime pin, ignore rules, and project README.
- React/Vite/TypeScript client with responsive learner dashboard, sign-in, registration, and API integration.
- NestJS/TypeScript API with validated environment configuration, versioned REST prefix, health route, MySQL/TypeORM setup, and schema synchronization disabled.
- Reviewed migrations for roles, accounts/sessions, teacher approval, versioned curriculum, learner completions, and starter lesson content.
- Teacher role-change requests, administrative approval/rejection, paginated account/request listings, and transactional deactivation/session revocation.
- Versioned curriculum modules, lessons, publication workflow, completion tracking, and learner progress endpoints backed by reviewed MySQL migrations.
- Client lesson catalog and reader/completion flow connected to the API.
- Identity vertical slice: Student-only public registration, Argon2id passwords, login, short-lived JWT access token, rotating hashed refresh tokens in HttpOnly cookies, logout, and authenticated `/me` profile.
- Global and stricter authentication request throttling; proxy-hop configuration for accurate client IP handling.
- One-time command-line Administrator bootstrap; no public admin creation route.

### Implementation boundaries

- Quiz authoring/attempts, classrooms, challenges/sandbox worker, points/badges, reporting, admin management UI, and retention jobs remain unimplemented; related dashboard sections are placeholders.
- Student code execution is not provided or enabled.
- Email verification and self-service recovery remain deferred; email is not used as proof of identity.

### Verification and limitations

- Node.js 24 and npm are available in the environment.
- Installed npm dependencies and generated the workspace lockfile. Frontend/backend production builds and workspace lint passed after identity and curriculum work. No tests were added or run.
- MySQL 8 is required but no database connection/credentials were supplied, so no database was created and the migration was not applied.
- `npm audit` reports 18 advisories (15 high, 3 moderate, 0 critical), mainly in transitive build tooling and TypeORM CLI dependencies. `npm audit fix` offered only major-version downgrades/upgrades for the implicated top-level tools, so those were not applied automatically; review/upgrade the dependency tree before production.

## 2026-11-18 — Local MySQL migration recovery

### User request

- Diagnose and fix the local migration failure after the user authorized database access and updated the local DB credentials.

### Changes and resolution

- Confirmed the API was loading database settings but the supplied DB credential initially failed authentication. After the user updated it, the connection succeeded.
- The initial identity migration applied successfully. The teacher-approval migration then exposed a MySQL constraint issue around the generated pending-request column and its foreign key.
- Changed pending-request uniqueness to rely on the existing transaction lock on the student account, while retaining both foreign keys. Made the migration retry-safe and removed only the empty, unrecorded partial request table created by the failed attempt.
- Removed reliance on TypeORM metadata-table introspection for the generated column check.
- Rebuilt the project and applied all four migrations successfully.

### Verification

- Confirmed all four migration records exist, the Java Foundations lesson is published, and role-request, lesson, version, and completion foreign keys are present.
- No test suite was added or run.
