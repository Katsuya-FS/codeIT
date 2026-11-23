import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccessGuard } from './access.guard';
import { RequireRoles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

type CountRow = { total: string | number };

@Controller('admin/dashboard')
@UseGuards(AccessGuard, RolesGuard)
@RequireRoles('Administrator')
export class AdminDashboardController {
  constructor(private readonly db: DataSource) {}

  @Get()
  async summary() {
    const [accountRows, lessonRows, challengeRows] = await Promise.all([
      this.db.query("SELECT role_name AS roleName, COUNT(*) AS total FROM `UserAccounts` WHERE role_name IN ('Teacher','Student') GROUP BY role_name") as Promise<Array<{ roleName: string; total: string | number }>>,
      this.db.query("SELECT COUNT(DISTINCT lesson.id) AS total FROM `Lessons` lesson INNER JOIN `LessonVersions` version ON version.lesson_id = lesson.id AND version.status = 'published' WHERE lesson.status = 'published'") as Promise<CountRow[]>,
      this.db.query("SELECT COUNT(*) AS total FROM `CodingChallenges` WHERE status = 'published'") as Promise<CountRow[]>,
    ]);
    const counts = new Map(accountRows.map((row) => [row.roleName, Number(row.total)]));
    return {
      students: counts.get('Student') ?? 0,
      teachers: counts.get('Teacher') ?? 0,
      publishedLessons: Number(lessonRows[0]?.total ?? 0),
      publishedChallenges: Number(challengeRows[0]?.total ?? 0),
    };
  }

  @Get('lessons')
  async lessons(@Query('page') pageValue = '1', @Query('limit') limitValue = '25', @Query('search') searchValue = '') {
    const { page, limit, offset } = this.pagination(pageValue, limitValue);
    const search = searchValue.trim();
    if (search.length > 120) throw new BadRequestException('Content search must be 120 characters or fewer.');
    const where = `lesson.status = 'published' AND EXISTS (SELECT 1 FROM \`LessonVersions\` version WHERE version.lesson_id = lesson.id AND version.status = 'published')`;
    const searchClause = search ? ' AND (lesson.title LIKE ? OR module.title LIKE ?)' : '';
    const params = search ? [`%${search}%`, `%${search}%`] : [];
    const [rows, countRows] = await Promise.all([
      this.db.query(`SELECT lesson.id, lesson.title, lesson.sequence, module.title AS moduleTitle, module.status AS moduleStatus,
        (SELECT MAX(version.version_number) FROM \`LessonVersions\` version WHERE version.lesson_id = lesson.id AND version.status = 'published') AS publishedVersion
        FROM \`Lessons\` lesson INNER JOIN \`CourseModules\` module ON module.id = lesson.module_id
        WHERE ${where}${searchClause} ORDER BY module.sequence ASC, lesson.sequence ASC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      this.db.query(`SELECT COUNT(*) AS total FROM \`Lessons\` lesson INNER JOIN \`CourseModules\` module ON module.id = lesson.module_id WHERE ${where}${searchClause}`, params) as Promise<CountRow[]>,
    ]);
    return { data: rows, page, limit, total: Number(countRows[0]?.total ?? 0) };
  }

  @Get('challenges')
  async challenges(@Query('page') pageValue = '1', @Query('limit') limitValue = '25', @Query('search') searchValue = '') {
    const { page, limit, offset } = this.pagination(pageValue, limitValue);
    const search = searchValue.trim();
    if (search.length > 120) throw new BadRequestException('Content search must be 120 characters or fewer.');
    const searchClause = search ? ' AND title LIKE ?' : '';
    const params = search ? [`%${search}%`] : [];
    const [rows, countRows] = await Promise.all([
      this.db.query(`SELECT id, title, difficulty, sequence, status FROM \`CodingChallenges\` WHERE status = 'published'${searchClause} ORDER BY sequence ASC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      this.db.query(`SELECT COUNT(*) AS total FROM \`CodingChallenges\` WHERE status = 'published'${searchClause}`, params) as Promise<CountRow[]>,
    ]);
    return { data: rows, page, limit, total: Number(countRows[0]?.total ?? 0) };
  }

  private pagination(pageValue: string, limitValue: string) {
    if (!/^\d+$/.test(pageValue) || !/^\d+$/.test(limitValue)) throw new BadRequestException('Page and limit must be positive integers.');
    const page = Number(pageValue); const requestedLimit = Number(limitValue);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000 || !Number.isSafeInteger(requestedLimit) || requestedLimit < 1) throw new BadRequestException('Page or limit is outside the supported range.');
    const limit = Math.min(100, requestedLimit);
    return { page, limit, offset: (page - 1) * limit };
  }
}
