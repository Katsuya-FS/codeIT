import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../identity/auth.module';
import { StudentProfile } from '../identity/entities/student-profile.entity';
import { CourseModule } from './entities/course-module.entity';
import { Lesson } from './entities/lesson.entity';
import { LessonVersion } from './entities/lesson-version.entity';
import { LessonCompletion } from './entities/lesson-completion.entity';
import { LearningService } from './learning.service';
import { LessonsController } from './lessons.controller';
import { CurriculumAdminController } from './curriculum-admin.controller';
import { ChallengesController } from './challenges.controller';
import { AdminLessonSubmissionsController, ApprovedLessonFileController, TeacherLessonSubmissionsController } from './lesson-submissions.controller';
import { LessonSubmissionsService } from './lesson-submissions.service';

@Module({
  imports: [TypeOrmModule.forFeature([StudentProfile, CourseModule, Lesson, LessonVersion, LessonCompletion]), AuthModule],
  controllers: [LessonsController, CurriculumAdminController, ChallengesController, TeacherLessonSubmissionsController, AdminLessonSubmissionsController, ApprovedLessonFileController],
  providers: [LearningService, LessonSubmissionsService],
})
export class LearningModule {}
