# CodeIT

CodeIT is a Java fundamentals learning platform. The approved architecture and delivery decisions are documented in [ARCHITECTURE_DELIVERY_PLAN.md](./ARCHITECTURE_DELIVERY_PLAN.md).

## Project status

The project includes React/Vite client, NestJS API, MySQL/TypeORM, Student registration/login, rotating refresh sessions, Teacher role requests, Administrator review/account controls, versioned curriculum, lesson completion tracking, five coding challenges, and classroom management. Teachers can create classrooms, approve/reject student join requests, and assign published challenges. Students join with a classroom code and can view current classes and assignments. Each first completed lesson and challenge awards 5 points in an idempotent ledger. A separate local interpreter process evaluates a bounded Java learning subset; it does not invoke `javac` or run arbitrary Java bytecode. Quiz authoring/assignments, badges, and reporting remain future work.

The curriculum migrations seed six sample Java Foundations lessons, five challenge statements, public examples, and server-side hidden test data so a new database has published learning content.

## Requirements

- Node.js 24 LTS and npm
- MySQL 8

## Local setup

1. Create a MySQL database and a least-privilege application user. Copy `server/.env.example` to `server/.env` and set database credentials, a random JWT secret, and a separate random `JAVA_RUNNER_TOKEN` (both at least 32 characters).
2. Install dependencies from the repository root with `npm install`.
3. Build the workspaces with `npm run build` so the API and migration CLI are available.
4. Apply the reviewed migration with `npm run db:migrate`.
5. Start the client, API, and local interpreter with `npm run dev`.

After migrations, create local-only Student, Teacher, and Administrator demo accounts with `npm --workspace server run seed:demo`. It prints a separate random password for each newly created account once; save the output securely. The seed command refuses to run in production and stores only Argon2id password hashes.

The client is served at `http://localhost:5173`; the versioned API is at `http://localhost:3000/api/v1`. Health check: `GET /api/v1/health`.

Implemented API slices include `POST /auth/register|login|refresh|logout`, `GET /me`, Student `POST /role-requests`, Administrator role/account management, learner lesson catalog/detail/completion/progress, authenticated challenge catalog/submission, and teacher/student classroom routes for creation, join approval, membership, and published-challenge assignments. Administrator curriculum routes create/publish modules, lessons, and lesson versions. Challenge submissions are sent to the localhost-only interpreter, which checks custom input and server-side sample/hidden cases and returns program output plus aggregate results. It accepts a small Java syntax subset used by the included exercises; unsupported syntax appears as an interpreter message.

### Initial administrator

After applying migrations, run `npm --workspace server run bootstrap:admin` once with `ADMIN_EMAIL`, `ADMIN_DISPLAY_NAME`, and a unique `ADMIN_PASSWORD` of at least 16 characters supplied through the deployment environment. Remove the bootstrap password from the environment immediately afterward. The command refuses to create a second administrator. There is no public administrator registration.

## Security notes

- Passwords use Argon2id. Refresh tokens are held in an HttpOnly, SameSite=Lax cookie and only their SHA-256 hashes are persisted. Access tokens remain in client memory.
- The API does not interpret submissions itself. Local challenge checks go to a separate, localhost-only interpreter process that parses a bounded Java subset without launching a shell, compiler, or user-controlled process. Do not expand this to arbitrary Java or production workloads without an OS/container sandbox.
- Authentication requests are throttled to five per minute per client IP, with a global limit of 60 requests per minute per IP. The default throttler store is process-local; configure shared storage before running multiple API instances. Set `TRUST_PROXY_HOPS` only to the number of trusted reverse-proxy hops so client IP limits are accurate.
- Email verification and self-service recovery are not implemented; email is not proof of identity for account recovery.
- TypeORM schema synchronization is disabled. Database changes must be made through reviewed migrations.
- The initial dependency audit reported 18 advisories (15 high, 3 moderate). The available automated fixes required major top-level version changes, so they were not forced; review and resolve these advisories before production deployment.
