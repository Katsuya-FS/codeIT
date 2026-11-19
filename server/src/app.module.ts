import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './config/environment';
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
import { AuthModule } from './identity/auth.module';
import { HealthController } from './health.controller';
import { LearningModule } from './learning/learning.module';
import { ClassroomsModule } from './classrooms/classrooms.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow<string>('DB_USERNAME'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_DATABASE'),
        entities: [Role, UserAccount, StudentProfile, TeacherProfile, RoleChangeRequest, RefreshSession, CourseModule, Lesson, LessonVersion, LessonCompletion],
        synchronize: false,
        migrationsRun: false,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        charset: 'utf8mb4',
        timezone: 'Z',
        extra: { connectionLimit: 10 },
      }),
    }),
    AuthModule,
    LearningModule,
    ClassroomsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
