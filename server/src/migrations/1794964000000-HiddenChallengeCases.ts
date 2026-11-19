import { MigrationInterface, QueryRunner } from 'typeorm';

export class HiddenChallengeCases1794964000000 implements MigrationInterface {
  name = 'HiddenChallengeCases1794964000000';
  async up(q: QueryRunner): Promise<void> {
    const cases = [
      ['ea1f1a2a-2145-4a6e-a101-000000000002', '0 0', '0'],
      ['ea1f1a2a-2145-4a6e-a101-000000000003', '0', 'Even'],
      ['ea1f1a2a-2145-4a6e-a101-000000000004', '1', '1'],
      ['ea1f1a2a-2145-4a6e-a101-000000000005', 'level', 'level'],
    ] as const;
    let sequence = 100;
    for (const [challengeId, input, output] of cases) {
      await q.query('INSERT IGNORE INTO `ChallengeTestCases` (`id`,`challenge_id`,`input_data`,`expected_output`,`is_sample`) VALUES (?,?,?,?,?)', [`ea1f1a2a-2145-4a6e-a101-${String(sequence++).padStart(12, '0')}`, challengeId, input, output, false]);
    }
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM `ChallengeTestCases` WHERE `id` IN ('ea1f1a2a-2145-4a6e-a101-000000000100','ea1f1a2a-2145-4a6e-a101-000000000101','ea1f1a2a-2145-4a6e-a101-000000000102','ea1f1a2a-2145-4a6e-a101-000000000103')");
  }
}
