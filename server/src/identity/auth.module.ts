import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshSession } from './entities/refresh-session.entity';
import { Role } from './entities/role.entity';
import { StudentProfile } from './entities/student-profile.entity';
import { UserAccount } from './entities/user-account.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessGuard } from './access.guard';
import { MeController, PublicProfilesController } from './me.controller';
import { RoleRequestsController } from './role-requests.controller';
import { AccountsController } from './accounts.controller';
import { RoleChangeRequest } from './entities/role-change-request.entity';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { RolesGuard } from './roles.guard';
import { AdminDashboardController } from './admin-dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserAccount, StudentProfile, TeacherProfile, RoleChangeRequest, Role, RefreshSession]), JwtModule.register({})],
  controllers: [AuthController, MeController, PublicProfilesController, RoleRequestsController, AccountsController, AdminDashboardController],
  providers: [AuthService, AccessGuard, RolesGuard],
  exports: [AuthService, AccessGuard, RolesGuard],
})
export class AuthModule {}
