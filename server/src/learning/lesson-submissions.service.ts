import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { UserAccount } from '../identity/entities/user-account.entity';

export type LessonPdfUpload = { buffer: Buffer; size: number; originalname: string; mimetype: string };
type SubmissionRow = { id: string; teacher_user_id: string; module_id: string; stored_file_name: string; original_file_name: string; status: string; [key: string]: unknown };
const maxPdfBytes = 10 * 1024 * 1024;

@Injectable()
export class LessonSubmissionsService {
  private readonly uploadDirectory: string;

  constructor(private readonly db: DataSource, config: ConfigService) {
    const serverDirectory = resolve(__dirname, '../..');
    this.uploadDirectory = resolve(serverDirectory, config.get<string>('LESSON_UPLOAD_DIR') || './uploads/lesson-submissions');
  }

  async listPublishedModules(teacher: UserAccount) {
    await this.requireTeacher(teacher.id);
    return this.db.query("SELECT id, title, sequence FROM `CourseModules` WHERE status = 'published' ORDER BY sequence ASC");
  }

  async listTeacherSubmissions(teacher: UserAccount) {
    await this.requireTeacher(teacher.id);
    return this.db.query(`SELECT submission.id, submission.title, submission.description, submission.status,
      submission.original_file_name AS fileName, submission.file_size AS fileSize,
      submission.rejection_reason AS rejectionReason, submission.created_at AS createdAt,
      submission.published_lesson_id AS publishedLessonId, module.title AS moduleTitle
      FROM \`TeacherLessonSubmissions\` submission
      INNER JOIN \`CourseModules\` module ON module.id = submission.module_id
      WHERE submission.teacher_user_id = ? ORDER BY submission.created_at DESC`, [teacher.id]);
  }

  async submit(teacher: UserAccount, body: { title?: string; description?: string; moduleId?: string }, file?: LessonPdfUpload) {
    await this.requireTeacher(teacher.id);
    const title = body.title?.trim() ?? ''; const description = body.description?.trim() ?? '';
    if (title.length < 2 || title.length > 180) throw new BadRequestException('Lesson title must be between 2 and 180 characters.');
    if (description.length < 10 || description.length > 5000) throw new BadRequestException('Lesson description must be between 10 and 5,000 characters.');
    if (!body.moduleId || !/^[\da-f-]{36}$/i.test(body.moduleId)) throw new BadRequestException('Choose a published module.');
    const [module] = await this.db.query("SELECT id FROM `CourseModules` WHERE id = ? AND status = 'published' LIMIT 1", [body.moduleId]);
    if (!module) throw new BadRequestException('That module is not currently published. Choose another module.');
    if (!file?.buffer?.length) throw new BadRequestException('Choose a PDF lesson file to upload.');
    if (file.size > maxPdfBytes || file.buffer.length > maxPdfBytes) throw new BadRequestException('PDF files must be 10 MiB or smaller.');
    if (!file.originalname.toLowerCase().endsWith('.pdf') || file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new BadRequestException('The uploaded file must be a valid PDF.');

    const id = randomUUID(); const storedFileName = `${randomUUID()}.pdf`;
    const safeOriginalName = basename(file.originalname.replace(/\\/g, '/')).replace(/[\r\n"]/g, '_').slice(0, 255) || 'lesson.pdf';
    await mkdir(this.uploadDirectory, { recursive: true });
    const filePath = join(this.uploadDirectory, storedFileName);
    await writeFile(filePath, file.buffer, { flag: 'wx' });
    try {
      await this.db.query(`INSERT INTO \`TeacherLessonSubmissions\`
        (id, teacher_user_id, module_id, title, description, stored_file_name, original_file_name, file_size, mime_type, status)
        VALUES (?,?,?,?,?,?,?,?,?,'pending')`, [id, teacher.id, body.moduleId, title, description, storedFileName, safeOriginalName, file.size, 'application/pdf']);
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
    return { id, title, moduleId: body.moduleId, fileName: safeOriginalName, status: 'pending' };
  }

  async listForAdmin(status = 'pending', pageValue = '1', limitValue = '25', searchValue = '') {
    if (!['pending', 'approved', 'rejected', 'all'].includes(status)) throw new BadRequestException('Invalid submission status filter.');
    const { page, limit, offset } = this.pagination(pageValue, limitValue);
    const search = searchValue.trim();
    if (search.length > 120) throw new BadRequestException('Submission search must be 120 characters or fewer.');
    const clauses: string[] = []; const params: unknown[] = [];
    if (status !== 'all') { clauses.push('submission.status = ?'); params.push(status); }
    if (search) { clauses.push('(submission.title LIKE ? OR teacher.display_name LIKE ? OR teacher.email LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows, countRows] = await Promise.all([
      this.db.query(`SELECT submission.id, submission.title, submission.description, submission.status,
        submission.original_file_name AS fileName, submission.file_size AS fileSize,
        submission.rejection_reason AS rejectionReason, submission.created_at AS createdAt,
        module.id AS moduleId, module.title AS moduleTitle, teacher.id AS teacherId,
        teacher.display_name AS teacherName, teacher.email AS teacherEmail
        FROM \`TeacherLessonSubmissions\` submission
        INNER JOIN \`CourseModules\` module ON module.id = submission.module_id
        INNER JOIN \`UserAccounts\` teacher ON teacher.id = submission.teacher_user_id
        ${where} ORDER BY submission.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      this.db.query(`SELECT COUNT(*) AS total FROM \`TeacherLessonSubmissions\` submission
        INNER JOIN \`UserAccounts\` teacher ON teacher.id = submission.teacher_user_id ${where}`, params) as Promise<Array<{ total: string | number }>>,
    ]);
    return { data: rows, page, limit, total: Number(countRows[0]?.total ?? 0) };
  }

  async approve(id: string, admin: UserAccount) {
    try {
      return await this.db.transaction(async (manager) => {
        const [submission] = await manager.query('SELECT * FROM `TeacherLessonSubmissions` WHERE id = ? FOR UPDATE', [id]) as SubmissionRow[];
        if (!submission) throw new NotFoundException('Lesson submission not found.');
        if (submission.status !== 'pending') throw new ConflictException('This submission has already been reviewed.');
        const [module] = await manager.query('SELECT id, status FROM `CourseModules` WHERE id = ? FOR UPDATE', [submission.module_id]);
        if (!module || module.status !== 'published') throw new ConflictException('The selected module is no longer published, so this submission cannot be approved.');
        const [sequenceRow] = await manager.query('SELECT COALESCE(MAX(sequence),0) AS lastSequence FROM `Lessons` WHERE module_id = ?', [submission.module_id]);
        const lessonId = randomUUID(); const versionId = randomUUID(); const sequence = Number(sequenceRow?.lastSequence ?? 0) + 1;
        await manager.query('INSERT INTO `Lessons` (id,module_id,title,sequence,status) VALUES (?,?,?,?,\'published\')', [lessonId, submission.module_id, submission.title, sequence]);
        await manager.query(`INSERT INTO \`LessonVersions\` (id,lesson_id,version_number,content,status,published_at)
          VALUES (?,?,1,?,'published',CURRENT_TIMESTAMP(3))`, [versionId, lessonId, submission.description]);
        await manager.query(`UPDATE \`TeacherLessonSubmissions\` SET status='approved', reviewed_by_user_id=?, reviewed_at=CURRENT_TIMESTAMP(3), published_lesson_id=? WHERE id=?`, [admin.id, lessonId, id]);
        return { id, status: 'approved', lessonId, versionId, sequence };
      });
    } catch (error) {
      if (this.isDuplicate(error)) throw new ConflictException('The lesson sequence changed while approving. Please retry.');
      throw error;
    }
  }

  async reject(id: string, admin: UserAccount, reasonValue: string) {
    const reason = reasonValue.trim();
    if (reason.length < 5 || reason.length > 2000) throw new BadRequestException('Provide a rejection reason between 5 and 2,000 characters.');
    return this.db.transaction(async (manager) => {
      const [submission] = await manager.query('SELECT status FROM `TeacherLessonSubmissions` WHERE id = ? FOR UPDATE', [id]);
      if (!submission) throw new NotFoundException('Lesson submission not found.');
      if (submission.status !== 'pending') throw new ConflictException('This submission has already been reviewed.');
      await manager.query(`UPDATE \`TeacherLessonSubmissions\` SET status='rejected', rejection_reason=?, reviewed_by_user_id=?, reviewed_at=CURRENT_TIMESTAMP(3) WHERE id=?`, [reason, admin.id, id]);
      return { id, status: 'rejected' };
    });
  }

  async adminFile(id: string) {
    const [submission] = await this.db.query('SELECT stored_file_name, original_file_name FROM `TeacherLessonSubmissions` WHERE id = ?', [id]) as Array<Pick<SubmissionRow, 'stored_file_name' | 'original_file_name'>>;
    if (!submission) throw new NotFoundException('Lesson submission not found.');
    return this.readStoredFile(submission.stored_file_name, submission.original_file_name);
  }

  async teacherFile(id: string, teacherId: string) {
    await this.requireTeacher(teacherId);
    const [submission] = await this.db.query('SELECT stored_file_name, original_file_name FROM `TeacherLessonSubmissions` WHERE id = ? AND teacher_user_id = ?', [id, teacherId]) as Array<Pick<SubmissionRow, 'stored_file_name' | 'original_file_name'>>;
    if (!submission) throw new NotFoundException('Lesson submission not found.');
    return this.readStoredFile(submission.stored_file_name, submission.original_file_name);
  }

  async studentLessonFile(lessonId: string, studentId: string) {
    const [profile] = await this.db.query('SELECT user_id FROM `StudentProfiles` WHERE user_id = ?', [studentId]);
    if (!profile) throw new ForbiddenException('A learner profile is required.');
    const [submission] = await this.db.query(`SELECT submission.stored_file_name, submission.original_file_name
      FROM \`TeacherLessonSubmissions\` submission
      INNER JOIN \`Lessons\` lesson ON lesson.id = submission.published_lesson_id AND lesson.status = 'published'
      INNER JOIN \`CourseModules\` module ON module.id = lesson.module_id AND module.status = 'published'
      WHERE submission.published_lesson_id = ? AND submission.status = 'approved'`, [lessonId]) as Array<Pick<SubmissionRow, 'stored_file_name' | 'original_file_name'>>;
    if (!submission) throw new NotFoundException('Lesson file not found.');
    return this.readStoredFile(submission.stored_file_name, submission.original_file_name);
  }

  private async requireTeacher(teacherId: string) {
    const [teacher] = await this.db.query('SELECT user_id FROM `TeacherProfiles` WHERE user_id = ?', [teacherId]);
    if (!teacher) throw new ForbiddenException('An approved Teacher profile is required.');
  }

  private async readStoredFile(fileName: string, originalName: string) {
    if (!/^[\da-f-]{36}\.pdf$/i.test(fileName)) throw new NotFoundException('Lesson file not found.');
    try { return { buffer: await readFile(join(this.uploadDirectory, fileName)), fileName: originalName }; }
    catch { throw new NotFoundException('The stored lesson file is unavailable.'); }
  }

  private pagination(pageValue: string, limitValue: string) {
    if (!/^\d+$/.test(pageValue) || !/^\d+$/.test(limitValue)) throw new BadRequestException('Page and limit must be positive integers.');
    const page = Number(pageValue); const requestedLimit = Number(limitValue);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000 || !Number.isSafeInteger(requestedLimit) || requestedLimit < 1) throw new BadRequestException('Page or limit is outside the supported range.');
    const limit = Math.min(100, requestedLimit);
    return { page, limit, offset: (page - 1) * limit };
  }

  private isDuplicate(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'ER_DUP_ENTRY'; }
}
