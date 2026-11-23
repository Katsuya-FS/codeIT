import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AccessGuard } from '../identity/access.guard';
import { UserAccount } from '../identity/entities/user-account.entity';
import { RequireRoles } from '../identity/roles.decorator';
import { RolesGuard } from '../identity/roles.guard';
import { LessonPdfUpload, LessonSubmissionsService } from './lesson-submissions.service';

const pdfUpload = FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 3, fieldSize: 20_000 },
  fileFilter: (_request, file, callback) => file.originalname.toLowerCase().endsWith('.pdf')
    ? callback(null, true)
    : callback(new BadRequestException('Upload a PDF file.'), false),
});

function sendPdf(response: Response, file: { buffer: Buffer; fileName: string }) {
  const safeName = file.fileName.replace(/[\r\n"]/g, '_');
  response.set({
    'Content-Type': 'application/pdf',
    'Content-Length': file.buffer.length,
    'Content-Disposition': `inline; filename="lesson.pdf"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  response.end(file.buffer);
}

@Controller()
@UseGuards(AccessGuard, RolesGuard)
@RequireRoles('Teacher')
export class TeacherLessonSubmissionsController {
  constructor(private readonly submissions: LessonSubmissionsService) {}

  @Get('teacher/lesson-submissions/modules') modules(@Req() request: Request & { user: UserAccount }) {
    return this.submissions.listPublishedModules(request.user);
  }

  @Get('teacher/lesson-submissions') listMine(@Req() request: Request & { user: UserAccount }) {
    return this.submissions.listTeacherSubmissions(request.user);
  }

  @Post('teacher/lesson-submissions')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(pdfUpload)
  submit(@Req() request: Request & { user: UserAccount }, @Body() body: { title?: string; description?: string; moduleId?: string }, @UploadedFile() file?: LessonPdfUpload) {
    return this.submissions.submit(request.user, body, file);
  }

  @Get('teacher/lesson-submissions/:id/file')
  async ownFile(@Req() request: Request & { user: UserAccount }, @Param('id') id: string, @Res() response: Response) {
    sendPdf(response, await this.submissions.teacherFile(id, request.user.id));
  }
}

@Controller('admin/dashboard/submissions')
@UseGuards(AccessGuard, RolesGuard)
@RequireRoles('Administrator')
export class AdminLessonSubmissionsController {
  constructor(private readonly submissions: LessonSubmissionsService) {}

  @Get() list(@Query('status') status = 'pending', @Query('page') page = '1', @Query('limit') limit = '25', @Query('search') search = '') {
    return this.submissions.listForAdmin(status, page, limit, search);
  }

  @Get(':id/file')
  async file(@Param('id') id: string, @Res() response: Response) {
    sendPdf(response, await this.submissions.adminFile(id));
  }

  @Post(':id/approve')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  approve(@Req() request: Request & { user: UserAccount }, @Param('id') id: string) {
    return this.submissions.approve(id, request.user);
  }

  @Post(':id/reject')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  reject(@Req() request: Request & { user: UserAccount }, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.submissions.reject(id, request.user, body.reason ?? '');
  }
}

@Controller('lessons')
@UseGuards(AccessGuard)
export class ApprovedLessonFileController {
  constructor(private readonly submissions: LessonSubmissionsService) {}

  @Get(':id/file')
  async file(@Req() request: Request & { user: UserAccount }, @Param('id') id: string, @Res() response: Response) {
    sendPdf(response, await this.submissions.studentLessonFile(id, request.user.id));
  }
}
