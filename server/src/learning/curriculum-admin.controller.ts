import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AccessGuard } from '../identity/access.guard';
import { RequireRoles } from '../identity/roles.decorator';
import { RolesGuard } from '../identity/roles.guard';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { LearningService } from './learning.service';

@Controller('admin')
@UseGuards(AccessGuard, RolesGuard)
@RequireRoles('Administrator')
export class CurriculumAdminController {
  constructor(private readonly learning: LearningService) {}
  @Post('modules') createModule(@Body() dto: CreateModuleDto) { return this.learning.createModule(dto); }
  @Post('modules/:id/lessons') createLesson(@Param('id') id: string, @Body() dto: CreateLessonDto) { return this.learning.createLesson(id, dto); }
  @Post('lessons/:id/versions') createVersion(@Param('id') id: string, @Body() dto: CreateVersionDto) { return this.learning.createVersion(id, dto); }
  @Post('lesson-versions/:id/publish') publishVersion(@Param('id') id: string) { return this.learning.publishVersion(id); }
  @Post('modules/:id/publish') publishModule(@Param('id') id: string) { return this.learning.publishModule(id); }
}
