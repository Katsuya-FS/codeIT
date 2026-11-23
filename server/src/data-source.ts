import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Role } from './identity/entities/role.entity';
import { UserAccount } from './identity/entities/user-account.entity';
import { StudentProfile } from './identity/entities/student-profile.entity';
import { RefreshSession } from './identity/entities/refresh-session.entity';
import { TeacherProfile } from './identity/entities/teacher-profile.entity';
import { RoleChangeRequest } from './identity/entities/role-change-request.entity';
import { CourseModule } from './learning/entities/course-module.entity';
import { Lesson } from './learning/entities/lesson.entity';
import { LessonVersion } from './learning/entities/lesson-version.entity';
import { LessonCompletion } from './learning/entities/lesson-completion.entity';
import { InitialIdentity1763400000000 } from './migrations/1763400000000-InitialIdentity';
import { TeacherApproval1794960000000 } from './migrations/1794960000000-TeacherApproval';
import { Curriculum1794961000000 } from './migrations/1794961000000-Curriculum';
import { StarterCurriculum1794962000000 } from './migrations/1794962000000-StarterCurriculum';
import { SampleLearningAndChallenges1794963000000 } from './migrations/1794963000000-SampleLearningAndChallenges';
import { HiddenChallengeCases1794964000000 } from './migrations/1794964000000-HiddenChallengeCases';
import { StudentPointsAndChallengeProgress1794965000000 } from './migrations/1794965000000-StudentPointsAndChallengeProgress';
import { Classrooms1794966000000 } from './migrations/1794966000000-Classrooms';
import { TeacherLessonSubmissions1794967000000 } from './migrations/1794967000000-TeacherLessonSubmissions';
import { UserProfiles1794968000000 } from './migrations/1794968000000-UserProfiles';
import { validateEnvironment } from './config/environment';

const env = validateEnvironment(process.env);
export default new DataSource({
  type: 'mysql', host: String(env.DB_HOST), port: Number(env.DB_PORT), username: String(env.DB_USERNAME),
  password: String(env.DB_PASSWORD), database: String(env.DB_DATABASE),
  entities: [Role, UserAccount, StudentProfile, TeacherProfile, RoleChangeRequest, RefreshSession, CourseModule, Lesson, LessonVersion, LessonCompletion],
  migrations: [InitialIdentity1763400000000, TeacherApproval1794960000000, Curriculum1794961000000, StarterCurriculum1794962000000, SampleLearningAndChallenges1794963000000, HiddenChallengeCases1794964000000, StudentPointsAndChallengeProgress1794965000000, Classrooms1794966000000, TeacherLessonSubmissions1794967000000, UserProfiles1794968000000], synchronize: false, migrationsRun: false,
  charset: 'utf8mb4', timezone: 'Z',
});
