import { Body, Controller, Get, NotFoundException, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { Request } from 'express';
import { AccessGuard } from './access.guard';
import { AuthService } from './auth.service';
import { UserAccount } from './entities/user-account.entity';
import { RequireRoles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class StatusDto { @IsIn(['active', 'inactive']) status!: 'active' | 'inactive'; }
class RoleDto { @IsIn(['Student', 'Teacher']) role!: 'Student' | 'Teacher'; }

@Controller('admin/users')
@UseGuards(AccessGuard, RolesGuard)
@RequireRoles('Administrator')
export class AccountsController {
  constructor(private readonly auth: AuthService) {}
  @Get() list(@Query('page') page?: string, @Query('limit') limit?: string, @Query('role') role?: string, @Query('search') search?: string) {
    return this.auth.listUsers(page, limit, role, search);
  }
  @Get(':id') async detail(@Param('id') id: string) {
    const user = await this.auth.getUser(id);
    if (!user) throw new NotFoundException('Account not found.');
    return user;
  }
  @Patch(':id/status') setStatus(@Param('id') id: string, @Body() dto: StatusDto, @Req() request: Request & { user: UserAccount }) {
    return this.auth.setUserStatus(id, dto.status, request.user);
  }
  @Patch(':id/role') setRole(@Param('id') id: string, @Body() dto: RoleDto, @Req() request: Request & { user: UserAccount }) {
    return this.auth.setUserRole(id, dto.role, request.user);
  }
}
