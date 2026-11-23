import { Controller, Get, Patch, Body, Param, UseGuards, Req, BadRequestException, NotFoundException } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { UserAccount } from './entities/user-account.entity';
import { AccessGuard } from './access.guard';

class UpdateProfileDto {
  @IsString() @MinLength(2) @MaxLength(80) displayName!: string;
  @IsString() @MaxLength(500) bio!: string;
}

@Controller('me')
@UseGuards(AccessGuard)
export class MeController {
  constructor(private readonly db: DataSource) {}

  @Get()
  getProfile(@Req() request: Request & { user: UserAccount }) {
    const user = request.user;
    return { id: user.id, email: user.email, displayName: user.displayName, bio: user.bio ?? '', role: user.roleName };
  }

  @Patch('profile')
  async updateProfile(@Req() request: Request & { user: UserAccount }, @Body() body: UpdateProfileDto) {
    if (!['Student', 'Teacher'].includes(request.user.roleName)) throw new BadRequestException('Only student and teacher profiles can be customized.');
    const displayName = body.displayName.trim();
    if (displayName.length < 2) throw new BadRequestException('Display name must contain at least two characters.');
    await this.db.query('UPDATE UserAccounts SET display_name = ?, bio = ? WHERE id = ?', [displayName, body.bio.trim(), request.user.id]);
    return { id: request.user.id, displayName, bio: body.bio.trim(), role: request.user.roleName };
  }
}

@Controller('profiles')
@UseGuards(AccessGuard)
export class PublicProfilesController {
  constructor(private readonly db: DataSource) {}

  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    const [profile] = await this.db.query("SELECT id, display_name AS displayName, bio, role_name AS role FROM UserAccounts WHERE id = ? AND status = 'active' AND role_name IN ('Student','Teacher') LIMIT 1", [id]);
    if (!profile) throw new NotFoundException('Profile not found.');
    return profile;
  }
}
