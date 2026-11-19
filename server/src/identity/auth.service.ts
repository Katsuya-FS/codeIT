import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshSession } from './entities/refresh-session.entity';
import { Role } from './entities/role.entity';
import { RoleChangeRequest } from './entities/role-change-request.entity';
import { StudentProfile } from './entities/student-profile.entity';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { UserAccount } from './entities/user-account.entity';

type PublicUser = { id: string; email: string; displayName: string; role: string };
type AuthResult = { user: PublicUser; accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(UserAccount) private readonly users: Repository<UserAccount>,
    @InjectRepository(RefreshSession) private readonly sessions: Repository<RefreshSession>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    try {
      const user = await this.dataSource.transaction(async (manager) => {
        const studentRole = await manager.getRepository(Role).findOneBy({ name: 'Student' });
        if (!studentRole) throw new Error('Student role seed is missing. Run the database migrations.');
        const account = manager.getRepository(UserAccount).create({
          id: randomUUID(), email, displayName: dto.displayName.trim(),
          passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }), roleName: studentRole.name, status: 'active',
        });
        await manager.getRepository(UserAccount).save(account);
        await manager.getRepository(StudentProfile).save({ userId: account.id });
        return account;
      });
      return this.issue(user);
    } catch (error) {
      if (this.isDuplicate(error)) throw new ConflictException('An account with this email already exists.');
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.createQueryBuilder('user').addSelect('user.passwordHash')
      .where('user.email = :email', { email: dto.email.trim().toLowerCase() }).getOne();
    const valid = user && user.status === 'active' && await argon2.verify(user.passwordHash, dto.password).catch(() => false);
    if (!valid || !user) throw new UnauthorizedException('Email or password is incorrect.');
    return this.issue(user);
  }

  async refresh(presented: string): Promise<AuthResult> {
    const oldHash = this.hashToken(presented);
    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RefreshSession);
      const old = await repo.createQueryBuilder('session').setLock('pessimistic_write')
        .where('session.tokenHash = :hash', { hash: oldHash }).getOne();
      if (!old || old.revokedAt || old.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('Refresh session is no longer valid.');
      const user = await manager.getRepository(UserAccount).findOne({ where: { id: old.userId }, relations: { role: true } });
      if (!user || user.status !== 'active') {
        old.revokedAt = new Date(); await repo.save(old);
        return null;
      }
      old.revokedAt = new Date(); await repo.save(old);
      return this.issue(user, manager);
    });
    if (!result) throw new UnauthorizedException('Account is inactive.');
    return result;
  }

  async logout(presented?: string): Promise<void> {
    if (!presented) return;
    await this.sessions.update({ tokenHash: this.hashToken(presented), revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async authenticate(token: string): Promise<UserAccount> {
    let payload: { sub: string };
    try { payload = await this.jwt.verifyAsync<{ sub: string }>(token, this.jwtOptions()); }
    catch { throw new UnauthorizedException('Access token is invalid or expired.'); }
    const user = await this.users.findOne({ where: { id: payload.sub }, relations: { role: true } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('Account is inactive or unavailable.');
    return user;
  }

  async requestTeacherRole(student: UserAccount) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const accounts = manager.getRepository(UserAccount);
        const account = await accounts.findOne({ where: { id: student.id }, lock: { mode: 'pessimistic_write' } });
        if (!account || account.status !== 'active' || account.roleName !== 'Student') throw new ForbiddenException('Only active Students may request Teacher approval.');
        const existing = await manager.getRepository(RoleChangeRequest).findOneBy({ studentUserId: account.id, status: 'pending' });
        if (existing) throw new ConflictException('A Teacher role request is already pending.');
        const request = await manager.getRepository(RoleChangeRequest).save({ id: randomUUID(), studentUserId: account.id, requestedRole: 'Teacher', status: 'pending', reviewingAdminUserId: null, decidedAt: null });
        return { id: request.id, status: request.status, requestedAt: request.requestedAt };
      });
    } catch (error) {
      if (this.isDuplicate(error)) throw new ConflictException('A Teacher role request is already pending.');
      throw error;
    }
  }

  async listRoleRequests(status = 'pending', pageValue = '1', limitValue = '25') {
    if (!['pending', 'approved', 'rejected', 'all'].includes(status)) throw new BadRequestException('Invalid request status.');
    const { page, limit, skip } = this.pagination(pageValue, limitValue);
    const query = this.dataSource.getRepository(RoleChangeRequest).createQueryBuilder('request')
      .leftJoinAndSelect('request.student', 'student').leftJoinAndSelect('request.reviewingAdmin', 'reviewer')
      .orderBy('request.requestedAt', 'DESC').skip(skip).take(limit);
    if (status !== 'all') query.where('request.status = :status', { status });
    const [rows, total] = await query.getManyAndCount();
    return { data: rows.map((row) => ({ id: row.id, status: row.status, requestedAt: row.requestedAt, decidedAt: row.decidedAt, student: { id: row.student.id, email: row.student.email, displayName: row.student.displayName }, reviewer: row.reviewingAdmin ? { id: row.reviewingAdmin.id, displayName: row.reviewingAdmin.displayName } : null })), page, limit, total };
  }

  async decideRoleRequest(id: string, admin: UserAccount, decision: 'approved' | 'rejected') {
    return this.dataSource.transaction(async (manager) => {
      const requests = manager.getRepository(RoleChangeRequest);
      const request = await requests.createQueryBuilder('request').setLock('pessimistic_write').where('request.id = :id', { id }).getOne();
      if (!request) throw new NotFoundException('Role request not found.');
      if (request.status !== 'pending') throw new ConflictException('This role request has already been decided.');
      const accounts = manager.getRepository(UserAccount);
      const student = await accounts.findOne({ where: { id: request.studentUserId }, lock: { mode: 'pessimistic_write' } });
      if (!student) throw new NotFoundException('Student account not found.');
      if (decision === 'approved') {
        const teacherRole = await manager.getRepository(Role).findOneBy({ name: 'Teacher' });
        if (!teacherRole) throw new Error('Teacher role seed is missing.');
        if (student.status !== 'active' || student.roleName !== 'Student') throw new ConflictException('Only an active Student can be promoted.');
        await manager.getRepository(TeacherProfile).save({ userId: student.id, approvedByUserId: admin.id, approvedAt: new Date() });
        student.roleName = teacherRole.name;
        await accounts.save(student);
      }
      request.status = decision;
      request.reviewingAdminUserId = admin.id;
      request.decidedAt = new Date();
      await requests.save(request);
      return { id: request.id, status: request.status, decidedAt: request.decidedAt };
    });
  }

  async listUsers(pageValue = '1', limitValue = '25') {
    const { page, limit, skip } = this.pagination(pageValue, limitValue);
    const [rows, total] = await this.users.findAndCount({
      select: { id: true, email: true, displayName: true, roleName: true, status: true, createdAt: true },
      order: { createdAt: 'DESC' }, skip, take: limit,
    });
    return { data: rows, page, limit, total };
  }

  async getUser(id: string) {
    const user = await this.users.findOne({
      where: { id }, select: { id: true, email: true, displayName: true, roleName: true, status: true, createdAt: true, updatedAt: true },
    });
    return user ?? null;
  }

  async setUserStatus(id: string, status: 'active' | 'inactive', admin: UserAccount) {
    if (id === admin.id && status === 'inactive') throw new BadRequestException('You cannot deactivate your own Administrator account.');
    return this.dataSource.transaction(async (manager) => {
      const accounts = manager.getRepository(UserAccount);
      const user = await accounts.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw new NotFoundException('Account not found.');
      user.status = status;
      await accounts.save(user);
      if (status === 'inactive') {
        await manager.getRepository(RefreshSession).createQueryBuilder().update().set({ revokedAt: new Date() })
          .where('user_id = :userId AND revoked_at IS NULL', { userId: user.id }).execute();
      }
      return { id: user.id, status: user.status };
    });
  }

  private async issue(user: UserAccount, manager = this.dataSource.manager): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.roleName }, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
      audience: this.config.getOrThrow<string>('JWT_AUDIENCE'), expiresIn: this.config.get<string>('ACCESS_TOKEN_TTL', '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
    const refreshToken = randomUUID() + randomUUID().replaceAll('-', '');
    const expiresAt = new Date(Date.now() + this.config.get<number>('REFRESH_TOKEN_DAYS', 30) * 86_400_000);
    await manager.getRepository(RefreshSession).save({ id: randomUUID(), userId: user.id, tokenHash: this.hashToken(refreshToken), expiresAt, revokedAt: null });
    return { user: { id: user.id, email: user.email, displayName: user.displayName, role: user.roleName }, accessToken, refreshToken };
  }

  private jwtOptions() {
    return { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), issuer: this.config.getOrThrow<string>('JWT_ISSUER'), audience: this.config.getOrThrow<string>('JWT_AUDIENCE') };
  }
  private hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private isDuplicate(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'ER_DUP_ENTRY'; }
  private pagination(pageValue: string, limitValue: string) {
    if (!/^\d+$/.test(pageValue) || !/^\d+$/.test(limitValue)) throw new BadRequestException('Page and limit must be positive integers.');
    const page = Number(pageValue);
    const requestedLimit = Number(limitValue);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000 || !Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
      throw new BadRequestException('Page or limit is outside the supported range.');
    }
    const limit = Math.min(100, requestedLimit);
    return { page, limit, skip: (page - 1) * limit };
  }
}
