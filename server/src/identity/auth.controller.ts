import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  private readonly cookieOptions;
  constructor(private readonly auth: AuthService, config: ConfigService) {
    this.cookieOptions = { httpOnly: true, secure: config.get('NODE_ENV') === 'production', sameSite: 'lax' as const, path: '/api/v1/auth' };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    return this.respond(await this.auth.register(dto), response);
  }
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.respond(await this.auth.login(dto), response);
  }
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = request.cookies?.codeit_refresh as string | undefined;
    if (!token) return this.auth.refresh('');
    return this.respond(await this.auth.refresh(token), response);
  }
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.codeit_refresh as string | undefined);
    response.clearCookie('codeit_refresh', this.cookieOptions);
  }
  private respond(result: Awaited<ReturnType<AuthService['login']>>, response: Response) {
    response.cookie('codeit_refresh', result.refreshToken, { ...this.cookieOptions, maxAge: 30 * 86_400_000 });
    return { accessToken: result.accessToken, user: result.user };
  }
}
