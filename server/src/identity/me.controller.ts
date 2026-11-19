import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { UserAccount } from './entities/user-account.entity';
import { AccessGuard } from './access.guard';

@Controller('me')
@UseGuards(AccessGuard)
export class MeController {
  @Get()
  getProfile(@Req() request: Request & { user: UserAccount }) {
    const user = request.user;
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.roleName };
  }
}
