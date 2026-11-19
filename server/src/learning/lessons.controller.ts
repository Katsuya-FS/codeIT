import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AccessGuard } from '../identity/access.guard';
import { UserAccount } from '../identity/entities/user-account.entity';
import { CompleteLessonDto } from './dto/complete-lesson.dto';
import { LearningService } from './learning.service';

@Controller()
@UseGuards(AccessGuard)
export class LessonsController {
  constructor(private readonly learning: LearningService) {}
  @Get('lessons') modules(@Req() request: Request & { user: UserAccount }) { return this.learning.listModules(request.user.id); }
  @Get('lessons/:id') lesson(@Req() request: Request & { user: UserAccount }, @Param('id') id: string) { return this.learning.getLesson(request.user.id, id); }
  @Post('lessons/:id/completions') complete(@Req() request: Request & { user: UserAccount }, @Param('id') id: string, @Body() dto: CompleteLessonDto) {
    return this.learning.completeLesson(request.user.id, id, dto.lessonVersionId);
  }
  @Get('me/progress') progress(@Req() request: Request & { user: UserAccount }) { return this.learning.getProgress(request.user.id); }
}
