import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, DeepPartial, ObjectLiteral, Repository } from 'typeorm';
import { StudentProfile } from '../identity/entities/student-profile.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { CourseModule } from './entities/course-module.entity';
import { Lesson } from './entities/lesson.entity';
import { LessonCompletion } from './entities/lesson-completion.entity';
import { LessonVersion } from './entities/lesson-version.entity';

@Injectable()
export class LearningService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(StudentProfile) private readonly students: Repository<StudentProfile>,
    @InjectRepository(CourseModule) private readonly modules: Repository<CourseModule>,
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(LessonVersion) private readonly versions: Repository<LessonVersion>,
    @InjectRepository(LessonCompletion) private readonly completions: Repository<LessonCompletion>,
  ) {}

  async listModules(userId: string) {
    await this.requireStudent(userId);
    const modules = await this.modules.createQueryBuilder('module').leftJoinAndSelect('module.lessons', 'lesson', 'lesson.status = :published', { published: 'published' })
      .leftJoinAndSelect('lesson.versions', 'version', 'version.status = :versionStatus', { versionStatus: 'published' })
      .where('module.status = :moduleStatus', { moduleStatus: 'published' })
      .orderBy('module.sequence', 'ASC').addOrderBy('lesson.sequence', 'ASC').addOrderBy('version.versionNumber', 'DESC').getMany();
    return modules.map((module) => ({
      id: module.id, title: module.title, sequence: module.sequence,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id, title: lesson.title, sequence: lesson.sequence,
        currentVersion: this.latestPublished(lesson.versions),
      })),
    }));
  }

  async getLesson(userId: string, lessonId: string) {
    await this.requireStudent(userId);
    const lesson = await this.lessons.createQueryBuilder('lesson').innerJoinAndSelect('lesson.module', 'module')
      .leftJoinAndSelect('lesson.versions', 'version', 'version.status = :status', { status: 'published' })
      .where('lesson.id = :lessonId AND lesson.status = :lessonStatus AND module.status = :moduleStatus', { lessonId, lessonStatus: 'published', moduleStatus: 'published' })
      .orderBy('version.versionNumber', 'DESC').getOne();
    if (!lesson) throw new NotFoundException('Lesson not found.');
    const version = this.latestPublished(lesson.versions, true);
    if (!version) throw new NotFoundException('Lesson not found.');
    return { id: lesson.id, title: lesson.title, module: { id: lesson.module.id, title: lesson.module.title }, version };
  }

  async completeLesson(userId: string, lessonId: string, versionId: string) {
    await this.requireStudent(userId);
    const version = await this.versions.createQueryBuilder('version').innerJoinAndSelect('version.lesson', 'lesson')
      .innerJoinAndSelect('lesson.module', 'module')
      .where('version.id = :versionId AND lesson.id = :lessonId AND version.status = :published AND lesson.status = :published AND module.status = :published', { versionId, lessonId, published: 'published' }).getOne();
    if (!version) throw new BadRequestException('The selected lesson version is not published.');
    return this.dataSource.transaction(async (manager) => {
      const insert = await manager.query(
        'INSERT IGNORE INTO `LessonCompletions` (`id`,`student_user_id`,`lesson_version_id`) VALUES (?,?,?)',
        [randomUUID(), userId, versionId],
      ) as { affectedRows?: number };
      const completion = await manager.getRepository(LessonCompletion).findOneByOrFail({ studentUserId: userId, lessonVersionId: versionId });
      const reward = await manager.query(
        'INSERT IGNORE INTO `PointLedgerEntries` (`id`,`student_user_id`,`source_type`,`source_id`,`points_delta`) VALUES (?,?,?,?,5)',
        [randomUUID(), userId, 'lesson', lessonId],
      ) as { affectedRows?: number };
      return {
        id: completion.id, lessonVersionId: versionId, completedAt: completion.completedAt,
        alreadyCompleted: Number(insert.affectedRows ?? 0) === 0,
        pointsAwarded: Number(reward.affectedRows ?? 0) === 1 ? 5 : 0,
      };
    });
  }

  async getProgress(userId: string) {
    await this.requireStudent(userId);
    const rows = await this.completions.find({ where: { studentUserId: userId }, relations: { lessonVersion: { lesson: { module: true } } }, order: { completedAt: 'DESC' } });
    const [lessonStats] = await this.dataSource.query('SELECT COUNT(DISTINCT lesson.id) AS total FROM `LessonCompletions` completion INNER JOIN `LessonVersions` version ON version.id = completion.lesson_version_id INNER JOIN `Lessons` lesson ON lesson.id = version.lesson_id WHERE completion.student_user_id = ?', [userId]);
    const [challengeStats] = await this.dataSource.query('SELECT COUNT(*) AS total FROM `StudentChallengeCompletions` WHERE student_user_id = ?', [userId]);
    const [points] = await this.dataSource.query('SELECT COALESCE(SUM(points_delta),0) AS total FROM `PointLedgerEntries` WHERE student_user_id = ?', [userId]);
    const challenges = await this.dataSource.query('SELECT challenge.id, challenge.title, completion.completed_at AS completedAt FROM `StudentChallengeCompletions` completion INNER JOIN `CodingChallenges` challenge ON challenge.id = completion.challenge_id WHERE completion.student_user_id = ? ORDER BY completion.completed_at DESC', [userId]);
    const total = Number(lessonStats?.total ?? 0);
    return {
      completedLessons: rows.map((row) => ({ lessonId: row.lessonVersion.lesson.id, lessonTitle: row.lessonVersion.lesson.title, moduleTitle: row.lessonVersion.lesson.module.title, version: row.lessonVersion.versionNumber, completedAt: row.completedAt })),
      completedChallenges: challenges,
      total, completedChallengeCount: Number(challengeStats?.total ?? 0), totalPoints: Number(points?.total ?? 0),
    };
  }

  async createModule(dto: CreateModuleDto) {
    return this.saveContent(this.modules, { id: randomUUID(), title: dto.title.trim(), sequence: dto.sequence, status: 'draft' });
  }
  async createLesson(moduleId: string, dto: CreateLessonDto) {
    if (!await this.modules.findOneBy({ id: moduleId })) throw new NotFoundException('Course module not found.');
    return this.saveContent(this.lessons, { id: randomUUID(), moduleId, title: dto.title.trim(), sequence: dto.sequence, status: 'draft' });
  }
  async createVersion(lessonId: string, dto: CreateVersionDto) {
    const lesson = await this.lessons.findOneBy({ id: lessonId });
    if (!lesson) throw new NotFoundException('Lesson not found.');
    const versionNumber = (await this.versions.maximum('versionNumber', { lessonId }) ?? 0) + 1;
    return this.versions.save({ id: randomUUID(), lessonId, versionNumber, content: dto.content, status: 'draft', publishedAt: null });
  }
  async publishVersion(versionId: string) {
    return this.dataSource.transaction(async (manager) => {
      const version = await manager.getRepository(LessonVersion).createQueryBuilder('version').setLock('pessimistic_write').where('version.id = :versionId', { versionId }).getOne();
      if (!version) throw new NotFoundException('Lesson version not found.');
      version.status = 'published'; version.publishedAt = new Date();
      const lesson = await manager.getRepository(Lesson).findOneByOrFail({ id: version.lessonId });
      lesson.status = 'published';
      await manager.getRepository(Lesson).save(lesson);
      await manager.getRepository(LessonVersion).save(version);
      return { id: version.id, lessonId: lesson.id, versionNumber: version.versionNumber, status: version.status, publishedAt: version.publishedAt };
    });
  }
  async publishModule(moduleId: string) {
    const module = await this.modules.findOneBy({ id: moduleId });
    if (!module) throw new NotFoundException('Course module not found.');
    const count = await this.lessons.countBy({ moduleId, status: 'published' });
    if (!count) throw new BadRequestException('Publish at least one lesson before publishing the module.');
    module.status = 'published';
    await this.modules.save(module);
    return { id: module.id, status: module.status };
  }

  private async requireStudent(userId: string) {
    if (!await this.students.findOneBy({ userId })) throw new ForbiddenException('A learner profile is required.');
  }
  private latestPublished(versions: LessonVersion[], includeContent = false) {
    const version = versions.filter((item) => item.status === 'published').sort((a, b) => b.versionNumber - a.versionNumber)[0];
    if (!version) return null;
    return includeContent
      ? { id: version.id, versionNumber: version.versionNumber, content: version.content, publishedAt: version.publishedAt }
      : { id: version.id, versionNumber: version.versionNumber, publishedAt: version.publishedAt };
  }
  private async saveContent<T extends ObjectLiteral>(repository: Repository<T>, entity: DeepPartial<T>) {
    try { return await repository.save(repository.create(entity)); }
    catch (error) { if (this.isDuplicate(error)) throw new ConflictException('The sequence number is already in use.'); throw error; }
  }
  private isDuplicate(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'ER_DUP_ENTRY'; }
}
