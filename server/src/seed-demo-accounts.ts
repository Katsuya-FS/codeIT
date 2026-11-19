import 'reflect-metadata';
import 'dotenv/config';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Role } from './identity/entities/role.entity';
import { UserAccount } from './identity/entities/user-account.entity';
import { StudentProfile } from './identity/entities/student-profile.entity';
import { TeacherProfile } from './identity/entities/teacher-profile.entity';
import { RefreshSession } from './identity/entities/refresh-session.entity';
import { RoleChangeRequest } from './identity/entities/role-change-request.entity';
import { CourseModule } from './learning/entities/course-module.entity';
import { Lesson } from './learning/entities/lesson.entity';
import { LessonVersion } from './learning/entities/lesson-version.entity';
import { LessonCompletion } from './learning/entities/lesson-completion.entity';
import { validateEnvironment } from './config/environment';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo accounts cannot be created in production.');
  const env = validateEnvironment(process.env);
  const dataSource = new DataSource({
    type: 'mysql', host: String(env.DB_HOST), port: Number(env.DB_PORT), username: String(env.DB_USERNAME), password: String(env.DB_PASSWORD), database: String(env.DB_DATABASE),
    entities: [Role, UserAccount, StudentProfile, TeacherProfile, RoleChangeRequest, RefreshSession, CourseModule, Lesson, LessonVersion, LessonCompletion], synchronize: false, charset: 'utf8mb4', timezone: 'Z',
  });
  await dataSource.initialize();
  try {
    const results: { email: string; role: string; password: string }[] = [];
    await dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserAccount); const roles = manager.getRepository(Role);
      for (const [email, displayName, roleName] of [
        ['admin@codeit.local', 'Demo Administrator', 'Administrator'],
        ['teacher@codeit.local', 'Demo Teacher', 'Teacher'],
        ['student@codeit.local', 'Demo Student', 'Student'],
      ]) {
        if (await users.findOneBy({ email })) continue;
        const password = randomBytes(18).toString('base64url'); const role = await roles.findOneByOrFail({ name: roleName });
        const account = await users.save(users.create({ id: randomUUID(), email, displayName, roleName: role.name, status: 'active', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) }));
        if (roleName !== 'Administrator') await manager.getRepository(StudentProfile).save({ userId: account.id });
        if (roleName === 'Teacher') await manager.getRepository(TeacherProfile).save({ userId: account.id, approvedByUserId: (await users.findOneByOrFail({ email: 'admin@codeit.local' })).id });
        results.push({ email, role: roleName, password });
      }
    });
    if (results.length) {
      console.log('Created local-only demo accounts. Save these passwords now; they are not stored in plaintext.');
      for (const item of results) console.log(`${item.role}: ${item.email} | password: ${item.password}`);
    } else console.log('All demo accounts already exist; no passwords were changed.');
  } finally { await dataSource.destroy(); }
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Demo account seeding failed.'); process.exitCode = 1; });
