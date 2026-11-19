import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AccessGuard } from '../identity/access.guard';
import { RequireRoles } from '../identity/roles.decorator';
import { RolesGuard } from '../identity/roles.guard';
import { UserAccount } from '../identity/entities/user-account.entity';
import { CreateClassroomActivityDto } from './dto/create-classroom-activity.dto';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { JoinClassroomDto } from './dto/join-classroom.dto';
import { ClassroomsService } from './classrooms.service';

@Controller('classrooms')
@UseGuards(AccessGuard, RolesGuard)
export class ClassroomsController {
  constructor(private readonly classrooms: ClassroomsService) {}

  @Post()
  @RequireRoles('Teacher')
  create(@Req() req: Request & { user: UserAccount }, @Body() dto: CreateClassroomDto) { return this.classrooms.create(req.user, dto.name); }

  @Get('teacher')
  @RequireRoles('Teacher')
  teacherList(@Req() req: Request & { user: UserAccount }) { return this.classrooms.listForTeacher(req.user); }

  @Get('student')
  @RequireRoles('Student')
  studentList(@Req() req: Request & { user: UserAccount }) { return this.classrooms.studentDashboard(req.user); }

  @Post('join-requests')
  @RequireRoles('Student')
  join(@Req() req: Request & { user: UserAccount }, @Body() dto: JoinClassroomDto) { return this.classrooms.requestJoin(req.user, dto.classCode); }

  @Get(':classroomId')
  @RequireRoles('Teacher')
  detail(@Req() req: Request & { user: UserAccount }, @Param('classroomId') id: string) { return this.classrooms.getForTeacher(req.user, id); }

  @Post(':classroomId/join-requests/:requestId/approve')
  @RequireRoles('Teacher')
  approve(@Req() req: Request & { user: UserAccount }, @Param('classroomId') classroomId: string, @Param('requestId') requestId: string) {
    return this.classrooms.decideRequest(req.user, classroomId, requestId, true);
  }

  @Post(':classroomId/join-requests/:requestId/reject')
  @RequireRoles('Teacher')
  reject(@Req() req: Request & { user: UserAccount }, @Param('classroomId') classroomId: string, @Param('requestId') requestId: string) {
    return this.classrooms.decideRequest(req.user, classroomId, requestId, false);
  }

  @Post(':classroomId/leave')
  @RequireRoles('Student')
  leave(@Req() req: Request & { user: UserAccount }, @Param('classroomId') classroomId: string) { return this.classrooms.leave(req.user, classroomId); }

  @Post(':classroomId/assignments')
  @RequireRoles('Teacher')
  assign(@Req() req: Request & { user: UserAccount }, @Param('classroomId') classroomId: string, @Body() dto: CreateClassroomActivityDto) {
    return this.classrooms.assignChallenge(req.user, classroomId, dto.challengeId);
  }
}
