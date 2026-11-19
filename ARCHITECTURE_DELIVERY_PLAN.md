# CodeIT Implementation Plan

## 1. Goal and approved stack

CodeIT is a college-level, gamified platform for learning Java fundamentals. Students study curriculum lessons, take quizzes, submit coding challenges, track progress, and earn points and badges. Teachers manage classrooms and classroom activities. Administrators manage accounts, curriculum content, platform configuration, and teacher approval requests.

Use the following stack:

- **Frontend:** React, Vite, TypeScript, React Router, and Fetch or Axios.
- **Backend:** Node.js 24 LTS, TypeScript, NestJS, and REST endpoints under `/api/v1`.
- **Database:** MySQL 8 with TypeORM and `mysql2`.
- **Schema management:** Reviewed TypeORM migrations. Automatic schema synchronization is disabled.
- **Code execution:** Separate sandbox service behind a provider-neutral API; student code is never run in the NestJS process or database host.

The former proposal to use ASP.NET Core, C#, EF Core, Pomelo, and SQLite is superseded. Implementation follows the reviewed decisions in this document; schema changes are created as reviewed migrations and automatic synchronization remains disabled.

## 2. Architecture

Use a modular monolith for the NestJS API. Organize modules by domain: Identity, Learning, Classrooms, Quizzes, Challenges, Gamification, and Reporting. Controllers translate HTTP requests and responses; DTOs validate input and define API contracts; services apply business rules; TypeORM entities and repositories provide persistence. Add no generic repository layer unless a concrete need warrants it.

The browser is a client, not a security boundary. It may hide navigation that a role cannot use, but every protected operation and ownership check is enforced by the API. The API communicates with the separate runner through a narrow interface and asynchronous job lifecycle.

### Frontend organization

Group React code by feature (`auth`, `lessons`, `quizzes`, `challenges`, `classrooms`, `gamification`, and role dashboards), with shared components, layouts, route guards, validation, API client, and error/loading patterns. Keep secrets, database access, and privileged business rules out of frontend code.

### Backend organization

Each NestJS feature module owns its controllers, DTOs, services, entities, and persistence operations. Shared infrastructure provides configuration validation, database connection, authentication, role guards, exception mapping, logging, and health checks. Use explicit response mapping to avoid leaking password hashes, correct quiz answers, hidden test cases, or private records.

## 3. Roles, accounts, and business rules

- Public registration always creates an active **Student** account. Role is assigned server-side; public input cannot set Teacher or Administrator.
- Exactly one active role is allowed per account. A Student may submit a Teacher role-change request. An Administrator approves or rejects it in the admin panel. Approval changes the active role and creates a Teacher profile while retaining the Student profile and all historical student records.
- Bootstrap the initial Administrator through a one-time, secured initialization process using deployment secrets. Never provide public Administrator registration.
- Hash passwords with Argon2id. Issue short-lived JWT access tokens and rotating, revocable refresh tokens; persist only refresh-token hashes. Login is blocked for inactive accounts and account deactivation revokes sessions.
- Email verification and self-service password recovery are deferred from the initial release. Treat unverified email as an unverified contact address: do not use it as proof of identity for role changes or recovery. Document an administrator-assisted recovery procedure with identity checks before launch; rate-limit and audit recovery actions. Add self-service verification/recovery before relying on email for account recovery or notifications.
- Teacher promotion changes the active role but does not erase learner history. A promoted Teacher may continue personal learning activities through the retained Student profile, earn learner rewards under the same rules, and access their own learner records; they cannot use student-only classroom enrollment actions while their active role is Teacher. Role guards must distinguish these explicitly allowed learner capabilities from student classroom capabilities.
- Lessons belong to the school curriculum and are available outside classrooms. Curriculum content is versioned when publication edits could change what a completion record means.
- Platform challenges are available outside classrooms. Teachers may author quizzes and challenges. A nullable teacher owner identifies platform-provided content; teacher-created content is assignable only to classrooms owned by that teacher.
- A classroom assignment targets exactly one quiz or one coding challenge. A teacher may create multiple assignments. Platform quizzes may be assigned to classrooms. Due-date and late-work enforcement are deferred.
- Students submit a classroom join request using the classroom identifier. The teacher may approve or reject. Pending requests grant no access; approval creates membership. Preserve membership history, but classroom reports include only current members.
- Initial quizzes are multiple-choice and allow at most two attempts. A quiz awards its configured participation points once per student, on the first submitted attempt, regardless of score; retries do not award additional participation points. Each challenge awards its configured participation points once per student on the first completed evaluation, including a failed evaluation; later submissions may improve progress/score but do not award repeat participation points. Enforce one reward per student/content in addition to source-level idempotency. Badge criteria must not grant repeatable points through repeated submissions unless explicitly configured with a bounded policy.
- Quiz attempts are created and submitted through server-controlled state transitions. The API never returns answer correctness during an active quiz; after submission, return only that student's score and permitted review data. Challenge feedback excludes hidden test inputs/expected outputs and is size-limited. Both activity types have per-account and per-IP rate limits; challenge submissions also have configured concurrency and daily quotas.
- Classroom join requests may be resubmitted after rejection or after an existing membership is left. Only one pending request and one active membership per classroom/student pair are permitted. Leaving/rejoining creates a new membership history row; past submissions remain historical and are excluded from current-member reports.
- Progress is derived from lesson completions, quiz attempts, and challenge submissions. Point balances are derived from an append-only point ledger. Badge rules and reward amounts are configurable.

## 4. Initial database model

Use InnoDB, explicit foreign keys, appropriate indexes, UTC timestamps, and migrations. Choose stable identifiers (UUIDs stored as `CHAR(36)` or `BINARY(16)`) consistently and use case-insensitive uniqueness for normalized email addresses.

| Table | Purpose and principal relationships |
|---|---|
| `Roles` | Seeded role catalog; unique role name. |
| `UserAccounts` | Login identity, email, password hash, active role FK, display name, account status, timestamps. |
| `StudentProfiles` | One-to-one profile keyed/FK by user ID; retained after Teacher promotion. |
| `TeacherProfiles` | One-to-one teacher profile; records approving Administrator and approval time. |
| `RoleChangeRequests` | Student FK, requested role, pending/approved/rejected state, reviewing Administrator FK and decision timestamps; enforce at most one pending request per user. |
| `RefreshSessions` | User FK, hashed refresh token, expiry, revocation, creation time; unique token hash. |
| `CourseModules` | Curriculum module title, sequence, and publication status. |
| `Lessons` | Module FK, title, sequence, status; unique module/sequence. Lessons are not classroom-owned. |
| `LessonVersions` | Lesson FK, version number, content, publish time; unique lesson/version. |
| `LessonCompletions` | Student FK, lesson-version FK, completion time; unique student/version. |
| `Quizzes` | Nullable Teacher FK (null means platform content), title, status, settings; two-attempt maximum. |
| `QuizQuestions` | Quiz FK, prompt, points, sequence; multiple-choice initially. |
| `QuizOptions` | Question FK, option text, correctness, sequence. Never return correctness before permitted review. |
| `QuizAttempts` | Quiz and student FKs, attempt number, status, timestamps, score; unique student/quiz/attempt number. |
| `QuizAnswers` | Attempt/question/selected-option FKs and awarded points; unique attempt/question. Enforce that selected option belongs to the question using a composite FK (question ID plus option ID), or an equivalent database constraint; service validation alone is insufficient. |
| `CodingChallenges` | Nullable Teacher FK (null means platform content), prompt, difficulty, runtime profile, status. |
| `ChallengeTestCases` | Challenge FK, input, expected output, visibility, sequence. Hidden cases remain server-side. |
| `ChallengeSubmissions` | Challenge/student FKs, source, student-scoped idempotency key, evaluation state, score, bounded feedback, timestamps; unique student/idempotency key. |
| `Classrooms` | Teacher FK, opaque classroom identifier, name, status, timestamps. Index/uniquely constrain the identifier. |
| `ClassroomJoinRequests` | Classroom/student FKs, pending/approved/rejected state, deciding teacher, request/decision timestamps; enforce one pending request per classroom/student pair with a generated nullable uniqueness key or transactional locking. |
| `ClassroomMemberships` | Classroom/student FKs, active/left state, join/leave timestamps; enforce one active membership per pair with a generated nullable uniqueness key or transactional locking. Preserve a separate row for each rejoin period. |
| `ClassroomActivities` | Classroom FK, exactly one Quiz FK or Challenge FK, optional availability/due metadata, creation time. Enforce one target and teacher ownership in service logic plus database constraints where supported. |
| `PointLedgerEntries` | Student FK, points delta, source type and source ID, award time; unique source type/source ID prevents duplicate source awards. Because a polymorphic source cannot use a normal FK, validate the source in the awarding transaction and use typed award references (or separate quiz/challenge award tables) if database-enforced referential integrity is required. Add a unique student/content reward key to enforce the once-per-content policy. |
| `BadgeDefinitions` | Unique badge name, description, criteria type/configuration, active flag. |
| `StudentBadges` | Student and badge FKs, award time; unique student/badge unless repeatability is later approved. |

Transactions cover registration/profile creation, teacher approval/profile/role changes, quiz submission/scoring/reward, challenge evaluation completion/reward, and classroom approval/membership creation. Use conditional updates or row locks for attempt numbering/caps, pending-request decisions, and active membership uniqueness to avoid concurrent-request races. Keep completed attempts, submissions, awards, and memberships as history; deactivate accounts rather than cascading away educational records. Apply a defined retention policy: retain educational records while the institution has a legitimate academic need, remove or anonymize them under its approved deletion schedule, delete source code and detailed runner feedback after 90 days by default, and retain security logs for 30 days by default. Make retention periods configurable and document legal/institutional overrides before production.

## 5. REST API inventory

All routes are versioned under `/api/v1`. Use request/response DTOs, input validation, pagination for lists, consistent error bodies, and appropriate `200`, `201`, `204`, `400`, `401`, `403`, `404`, and `409` statuses.

| Area | Routes (method + path) | Access |
|---|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` | Registration/login public; refresh/logout authenticated. |
| Teacher requests | `POST /role-requests`; `GET /admin/role-requests`; `POST /admin/role-requests/:id/approve`; `POST /admin/role-requests/:id/reject` | Student; Administrator. |
| Accounts | `GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/status` | Administrator. |
| Lessons | `GET /lessons`, `GET /lessons/:id`, `POST /lessons/:id/completions`; admin curriculum create/edit/publish routes | Authenticated students; Administrator manages curriculum. |
| Quizzes | `GET /quizzes`, `GET /quizzes/:id`, `POST /quizzes/:id/attempts`, `POST /quiz-attempts/:id/submit`; teacher/admin authoring routes | Authenticated learners with a Student profile may take published quizzes; owning Teacher or Administrator manages content. |
| Challenges | `GET /challenges`, `GET /challenges/:id`, `POST /challenges/:id/submissions`, `GET /challenge-submissions/:id`; teacher/admin authoring routes | Authenticated learners with a Student profile may submit and view their own result; owning Teacher or Administrator manages content. |
| Classrooms | `POST /classrooms`, teacher classroom list/detail; `POST /classrooms/:id/join-requests`; teacher list/approve/reject requests; member and assignment routes | Teacher owns classroom operations; active Student role requests/enrolls; Administrator oversight. |
| Gamification | `GET /me/points`, `GET /me/badges`; admin badge configuration routes | Student own data; Administrator configures. |
| Reporting | Student progress; teacher classroom performance; admin system summaries | Student own records; Teacher own classrooms/current members; Administrator platform-wide. |

Student profile IDs come from the authenticated principal, not request bodies. Resolve the principal's retained Student profile for learner activities, including promoted Teachers, but require the active Student role for classroom join/enrollment actions. Return `404` for inaccessible private resources where disclosing existence would be unsafe. Check resource ownership in service queries and mutations, not just the UI. Public lesson/quiz/challenge browsing is not allowed in v1; authentication is required, and only published content is listed to eligible learners.

## 6. Authentication and security

1. Registration validates email/password/display name, normalizes email, hashes password, assigns the Student role, and creates user/profile in one transaction. Email verification is not required in v1; the address is not trusted for recovery or identity proof.
2. Login checks password hash and active account status, then issues a short-lived signed JWT and a rotating refresh token. Store only the refresh-token hash.
3. Refresh rotates the session token atomically. Logout revokes the presented refresh session; deactivation revokes every active session.
4. JWT guards validate signature, issuer, audience, expiry, and account status. Role guards check role; services enforce resource ownership.
5. Teacher approval records the reviewer and transactionally changes the account role and adds its Teacher profile. Rejection retains Student role and request history. Promoted Teachers retain learner access through their Student profile, but cannot join classrooms as students.

Use TLS/HTTPS in deployed environments, strict CORS allowlists, rate limits on public authentication and submissions, parameterized ORM access, request size limits, secure headers, configuration validation, secret managers/environment configuration, and structured logs with sensitive fields redacted. Never return stack traces, secrets, hashes, hidden answers, hidden test cases, or raw infrastructure errors.

## 7. Java execution boundary

NestJS records a challenge submission and a durable execution-job/outbox record in one database transaction, then returns a submission identifier. A worker claims jobs with a lease, calls a provider-neutral executor adapter using the submission ID as an idempotency key, and persists status, score, and bounded sanitized compiler/runtime feedback. Retries use backoff and a maximum-attempt policy; exhausted jobs enter a visible failed state and can be safely requeued by an operator without duplicate scoring or rewards. The frontend polls the API for the result. Hidden test inputs and expected outputs never leave the execution service.

The worker must use an approved sandbox with disposable isolation, no network access or secrets, strict CPU/memory/time/process/output limits, restricted filesystem/system calls, and pinned Java versions. Do not execute source with `child_process`, `eval`, or direct host commands inside the API. If no approved executor is configured, return a clear unavailable state and do not run code. Vendor, hosting, and exact quotas remain deployment decisions.

## 8. Delivery phases

1. **Foundation:** Replace legacy backend scaffold; establish NestJS TypeScript project, validated configuration, MySQL/TypeORM, migration workflow, health endpoint, global validation/error handling, logging, and frontend API configuration.
2. **Identity and administration:** Registration, login/refresh/logout, secure Administrator bootstrap, account status, Student teacher-role request, and admin approval/rejection panel.
3. **Curriculum and classrooms:** Curriculum/module/lesson authoring and publication, versioned completion, classroom management, join request approvals/rejections, membership, and ownership-protected assignments.
4. **Assessment:** Multiple-choice quiz authoring and two-attempt learner workflow; platform and teacher challenges; durable submission/job lifecycle, quotas, and sandbox adapter integration.
5. **Gamification and reporting:** Idempotent point ledger, badges, student progress, and current-member classroom reports.
6. **Hardening and evaluation:** Security review, accessibility/usability, functional and API acceptance, migration/data-integrity checks, operational documentation, and ISO/IEC 25010 evaluation plan.

## 9. Verification and acceptance

- Build/lint frontend and backend; run API unit/integration checks and migration up/down checks against MySQL. Release gates include clean migration rollback on an empty test database, migration forward/backward integrity checks, and automated authorization tests for every role/resource boundary.
- Verify public registration cannot assign elevated roles; teacher approval/rejection and account deactivation/session revocation behave transactionally.
- Verify pending classroom requests grant no access, teacher decisions create memberships correctly, and teachers cannot operate on others' classes/content.
- Verify students cannot read each other's private data; teachers see only current members; historical progress survives role changes and deactivation.
- Verify quiz attempt cap of two, answer-key confidentiality, challenge test-case secrecy, output truncation/sanitization, safe sandbox failure handling, and no code execution when unconfigured.
- Verify duplicate request/submit retries do not duplicate memberships or points and scoring/points commit consistently; concurrent requests cannot exceed quiz attempt caps, create duplicate pending requests/memberships, or award the same content reward twice.
- Verify durable execution jobs recover from worker interruption, lease expiry, runner timeout, and exhausted retries; operator requeue is idempotent and no job is marked complete without persisted results.
- Verify promoted Teachers can read/use their own learner profile and records while classroom enrollment remains unavailable to them; rejected join requests and left memberships can be retried without losing history.
- Verify public browsing is denied, active quiz answers remain confidential, post-submission review follows the configured disclosure policy, and rate/concurrency quotas return bounded errors.
- Verify retention jobs remove/anonymize data according to configured periods and preserve records covered by an institutional retention override.

## 10. Assumptions and limitations

- The current workspace appears empty; there are no files available for backend conversion or production-data migration. If the prior .NET/SQLite scaffold exists elsewhere, it must be brought into this authorized workspace before its removal can be verified.
- No production dataset is expected in the SQLite starter database. Do not attempt to migrate data from it unless later provided and authorized.
- Java execution provider and hosting are undecided; safe no-execution behavior is required until configuration is approved.
- Point values, badge criteria, curriculum content format, and future due-date rules remain configuration/product decisions to finalize during their feature phase. Default data retention is 90 days for source code and detailed runner feedback, 30 days for security logs, and institutionally approved retention for academic records.
- Node.js 24 LTS is the planned runtime; pin a maintained patch version in runtime configuration when implementation begins.
