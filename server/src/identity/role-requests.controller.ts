import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AccessGuard } from './access.guard';
import { AuthService } from './auth.service';
import { UserAccount } from './entities/user-account.entity';
import { RequireRoles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller()
@UseGuards(AccessGuard, RolesGuard)
export class RoleRequestsController {
  constructor(private readonly auth: AuthService) {}

  @Post('role-requests')
  @RequireRoles('Student')
  requestTeacherRole(@Req() request: Request & { user: UserAccount }) {
    return this.auth.requestTeacherRole(request.user);
  }

  @Get('admin/role-requests')
  @RequireRoles('Administrator')
  listRequests(@Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.auth.listRoleRequests(status, page, limit);
  }

  @Post('admin/role-requests/:id/approve')
  @RequireRoles('Administrator')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id') id: string, @Req() request: Request & { user: UserAccount }) {
    return this.auth.decideRoleRequest(id, request.user, 'approved');
  }

  @Post('admin/role-requests/:id/reject')
  @RequireRoles('Administrator')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id') id: string, @Req() request: Request & { user: UserAccount }) {
    return this.auth.decideRoleRequest(id, request.user, 'rejected');
  }
}
