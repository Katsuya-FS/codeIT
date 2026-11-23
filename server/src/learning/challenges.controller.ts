import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Query, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { AccessGuard } from '../identity/access.guard';
import { UserAccount } from '../identity/entities/user-account.entity';

@Controller('challenges')
@UseGuards(AccessGuard)
export class ChallengesController {
  constructor(private readonly db: DataSource, private readonly config: ConfigService) {}

  private runnerConfig() {
    const url = this.config.get<string>('JAVA_RUNNER_URL'); const token = this.config.get<string>('JAVA_RUNNER_TOKEN');
    if (!url || !token) throw new ServiceUnavailableException('The local Java interpreter is not configured.');
    return { url: url.replace(/\/$/, ''), token };
  }

  private async ensureRunnable(request: Request & { user: UserAccount }, id: string) {
    const [profile] = await this.db.query('SELECT user_id FROM StudentProfiles WHERE user_id = ? LIMIT 1', [request.user.id]);
    if (!profile) throw new ForbiddenException('A learner profile is required.');
    const [challenge] = await this.db.query('SELECT id FROM CodingChallenges WHERE id = ? AND status = ?', [id, 'published']);
    if (!challenge) throw new NotFoundException('Challenge not found.');
  }

  @Post(':id/run')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async run(@Req() request: Request & { user: UserAccount }, @Param('id') id: string, @Body() body: { code?: string; input?: string }) {
    await this.ensureRunnable(request, id);
    if (typeof body.code !== 'string' || body.code.length > 50_000) throw new BadRequestException('Provide source code under 50,000 characters.');
    if (typeof body.input !== 'string' || body.input.length > 10_000) throw new BadRequestException('Provide standard input under 10,000 characters.');
    const { url, token } = this.runnerConfig();
    try {
      const response = await fetch(`${url}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: body.code, input: body.input }), signal: AbortSignal.timeout(12_000),
      });
      const result = await response.json() as { output?: string; error?: string };
      if (!response.ok || result.error) return { status: 'error', message: result.error ?? 'The interpreter rejected the request.', output: '' };
      return { status: 'ran', output: result.output ?? '' };
    } catch {
      throw new ServiceUnavailableException('The Java interpreter could not be reached. Restart the app with npm run dev.');
    }
  }

  @Post(':id/interactive-sessions')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async startInteractiveSession(@Req() request: Request & { user: UserAccount }, @Param('id') id: string, @Body() body: { code?: string }) {
    await this.ensureRunnable(request, id);
    if (typeof body.code !== 'string' || body.code.length > 50_000) throw new BadRequestException('Provide source code under 50,000 characters.');
    const { url, token } = this.runnerConfig();
    try {
      const response = await fetch(`${url}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ownerId: request.user.id, code: body.code }), signal: AbortSignal.timeout(12_000) });
      const result = await response.json() as { sessionId?: string; message?: string; error?: string };
      if (!response.ok || !result.sessionId) throw new Error(result.message ?? result.error ?? 'Could not start an interactive session.');
      return { sessionId: result.sessionId };
    } catch (error) {
      if (error instanceof Error && error.message !== 'fetch failed') throw new BadRequestException(error.message);
      throw new ServiceUnavailableException('The Java interpreter could not be reached. Restart the app with npm run dev.');
    }
  }

  @Get('interactive-sessions/:sessionId/events')
  async interactiveEvents(@Req() request: Request & { user: UserAccount }, @Param('sessionId') sessionId: string, @Query('cursor') cursor = '0') {
    const { url, token } = this.runnerConfig();
    try {
      const response = await fetch(`${url}/sessions/${encodeURIComponent(sessionId)}/events?ownerId=${encodeURIComponent(request.user.id)}&cursor=${encodeURIComponent(cursor)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000) });
      const result = await response.json() as { events?: unknown[]; finished?: boolean; message?: string };
      if (!response.ok) throw new NotFoundException(result.message ?? 'Interactive session not found.');
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException('The Java interpreter could not be reached.');
    }
  }

  @Post('interactive-sessions/:sessionId/input')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async interactiveInput(@Req() request: Request & { user: UserAccount }, @Param('sessionId') sessionId: string, @Body() body: { input?: string }) {
    if (typeof body.input !== 'string' || body.input.length > 1000) throw new BadRequestException('Enter input under 1,000 characters.');
    const { url, token } = this.runnerConfig();
    try {
      const response = await fetch(`${url}/sessions/${encodeURIComponent(sessionId)}/input?ownerId=${encodeURIComponent(request.user.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ input: body.input }), signal: AbortSignal.timeout(5_000) });
      const result = await response.json() as { accepted?: boolean; message?: string };
      if (!response.ok) throw new BadRequestException(result.message ?? 'The program is not waiting for input.');
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('The Java interpreter could not be reached.');
    }
  }

  @Delete('interactive-sessions/:sessionId')
  async endInteractiveSession(@Req() request: Request & { user: UserAccount }, @Param('sessionId') sessionId: string) {
    const { url, token } = this.runnerConfig();
    try {
      await fetch(`${url}/sessions/${encodeURIComponent(sessionId)}?ownerId=${encodeURIComponent(request.user.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000) });
      return { ended: true };
    } catch { throw new ServiceUnavailableException('The Java interpreter could not be reached.'); }
  }

  @Get()
  async list(@Req() request: Request & { user: UserAccount }) {
    const [profile] = await this.db.query('SELECT user_id FROM StudentProfiles WHERE user_id = ? LIMIT 1', [request.user.id]);
    if (!profile) return [];
    return this.db.query(`SELECT challenge.id, challenge.title, challenge.statement, challenge.difficulty,
      challenge.starter_code AS starterCode, challenge.sample_input AS sampleInput,
      challenge.sample_output AS sampleOutput, challenge.sequence,
      IF(completion.id IS NULL, 0, 1) AS completed
      FROM CodingChallenges challenge
      LEFT JOIN StudentChallengeCompletions completion ON completion.challenge_id = challenge.id AND completion.student_user_id = ?
      WHERE challenge.status = ? ORDER BY challenge.sequence`, [request.user.id, 'published']);
  }

  @Post(':id/submissions')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async submit(@Req() request: Request & { user: UserAccount }, @Param('id') id: string, @Body() body: { code?: string; input?: string }) {
    const [profile] = await this.db.query('SELECT user_id FROM StudentProfiles WHERE user_id = ? LIMIT 1', [request.user.id]);
    if (!profile) throw new ForbiddenException('A learner profile is required.');
    const [challenge] = await this.db.query('SELECT id FROM CodingChallenges WHERE id = ? AND status = ?', [id, 'published']);
    if (!challenge) throw new NotFoundException('Challenge not found.');
    if (typeof body.code !== 'string' || body.code.length > 50_000) throw new BadRequestException('Provide source code under 50,000 characters.');
    if (typeof body.input !== 'string' || body.input.length > 10_000) throw new BadRequestException('Provide standard input under 10,000 characters.');
    const runnerUrl = this.config.get<string>('JAVA_RUNNER_URL'); const runnerToken = this.config.get<string>('JAVA_RUNNER_TOKEN');
    if (!runnerUrl || !runnerToken) throw new ServiceUnavailableException('The local Java interpreter is not configured.');
    const cases = await this.db.query('SELECT input_data AS input, expected_output AS expected FROM ChallengeTestCases WHERE challenge_id = ? ORDER BY is_sample DESC', [id]);
    try {
      const response = await fetch(`${runnerUrl.replace(/\/$/, '')}/evaluate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${runnerToken}` },
        body: JSON.stringify({ code: body.code, customInput: body.input, cases }), signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error('The interpreter rejected the request.');
      const result = await response.json() as { output?: string; checks?: boolean[]; error?: string };
      if (result.error) return { status: 'error', message: result.error, output: '', passed: 0, total: cases.length };
      const passed = result.checks?.filter(Boolean).length ?? 0; const total = cases.length;
      const completed = total > 0 && result.checks?.length === total && passed === total;
      if (completed) {
        const award = await this.db.transaction(async (manager) => {
          await manager.query(
            'INSERT IGNORE INTO `StudentChallengeCompletions` (`id`,`student_user_id`,`challenge_id`) VALUES (?,?,?)',
            [randomUUID(), request.user.id, id],
          );
          const pointsInsert = await manager.query(
            'INSERT IGNORE INTO `PointLedgerEntries` (`id`,`student_user_id`,`source_type`,`source_id`,`points_delta`) VALUES (?,?,?,?,5)',
            [randomUUID(), request.user.id, 'challenge', id],
          ) as { affectedRows?: number };
          return Number(pointsInsert.affectedRows ?? 0) === 1 ? 5 : 0;
        });
        return { status: 'passed', completed: true, pointsAwarded: award, message: award ? 'All checks passed. You earned 5 points!' : 'All checks passed. This challenge was already completed.', output: result.output ?? '', passed, total };
      }
      return { status: 'failed', completed: false, pointsAwarded: 0, message: `${passed} of ${total} checks passed.`, output: result.output ?? '', passed, total };
    } catch {
      throw new ServiceUnavailableException('The Java interpreter could not be reached. Restart the app with npm run dev.');
    }
  }
}
