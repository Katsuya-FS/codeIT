import { MigrationInterface, QueryRunner } from 'typeorm';

export class StudentPointsAndChallengeProgress1794965000000 implements MigrationInterface {
  name = 'StudentPointsAndChallengeProgress1794965000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE \`PointLedgerEntries\` (
      \`id\` char(36) NOT NULL, \`student_user_id\` char(36) NOT NULL,
      \`source_type\` varchar(24) NOT NULL, \`source_id\` char(36) NOT NULL,
      \`points_delta\` int NOT NULL, \`awarded_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`), UNIQUE KEY \`UQ_PointLedgerEntries_student_source\` (\`student_user_id\`,\`source_type\`,\`source_id\`),
      KEY \`IDX_PointLedgerEntries_student\` (\`student_user_id\`),
      CONSTRAINT \`FK_PointLedgerEntries_student\` FOREIGN KEY (\`student_user_id\`) REFERENCES \`StudentProfiles\` (\`user_id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await q.query(`CREATE TABLE \`StudentChallengeCompletions\` (
      \`id\` char(36) NOT NULL, \`student_user_id\` char(36) NOT NULL, \`challenge_id\` char(36) NOT NULL,
      \`completed_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`), UNIQUE KEY \`UQ_StudentChallengeCompletions_student_challenge\` (\`student_user_id\`,\`challenge_id\`),
      KEY \`IDX_StudentChallengeCompletions_challenge\` (\`challenge_id\`),
      CONSTRAINT \`FK_StudentChallengeCompletions_student\` FOREIGN KEY (\`student_user_id\`) REFERENCES \`StudentProfiles\` (\`user_id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`FK_StudentChallengeCompletions_challenge\` FOREIGN KEY (\`challenge_id\`) REFERENCES \`CodingChallenges\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await q.query(`INSERT IGNORE INTO \`PointLedgerEntries\` (\`id\`,\`student_user_id\`,\`source_type\`,\`source_id\`,\`points_delta\`)
      SELECT UUID(), completion.\`student_user_id\`, 'lesson', lesson.\`id\`, 5
      FROM \`LessonCompletions\` completion
      INNER JOIN \`LessonVersions\` version ON version.\`id\` = completion.\`lesson_version_id\`
      INNER JOIN \`Lessons\` lesson ON lesson.\`id\` = version.\`lesson_id\`
      GROUP BY completion.\`student_user_id\`, lesson.\`id\``);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `StudentChallengeCompletions`');
    await q.query('DROP TABLE `PointLedgerEntries`');
  }
}
