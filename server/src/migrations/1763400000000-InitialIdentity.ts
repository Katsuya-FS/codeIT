import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialIdentity1763400000000 implements MigrationInterface {
  name = 'InitialIdentity1763400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`Roles\` (
      \`name\` varchar(32) NOT NULL,
      \`label\` varchar(120) NOT NULL,
      PRIMARY KEY (\`name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`INSERT INTO \`Roles\` (\`name\`, \`label\`) VALUES ('Student','Student'),('Teacher','Teacher'),('Administrator','Administrator')`);
    await queryRunner.query(`CREATE TABLE \`UserAccounts\` (
      \`id\` char(36) NOT NULL,
      \`email\` varchar(254) COLLATE utf8mb4_0900_ai_ci NOT NULL,
      \`password_hash\` varchar(255) NOT NULL,
      \`display_name\` varchar(80) NOT NULL,
      \`role_name\` varchar(32) NOT NULL,
      \`status\` varchar(16) NOT NULL DEFAULT 'active',
      \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`), UNIQUE KEY \`UQ_UserAccounts_email\` (\`email\`),
      KEY \`IDX_UserAccounts_role\` (\`role_name\`),
      CONSTRAINT \`FK_UserAccounts_role\` FOREIGN KEY (\`role_name\`) REFERENCES \`Roles\` (\`name\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE \`StudentProfiles\` (
      \`user_id\` char(36) NOT NULL,
      PRIMARY KEY (\`user_id\`),
      CONSTRAINT \`FK_StudentProfiles_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`UserAccounts\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE \`RefreshSessions\` (
      \`id\` char(36) NOT NULL,
      \`user_id\` char(36) NOT NULL,
      \`token_hash\` char(64) NOT NULL,
      \`expires_at\` datetime(3) NOT NULL,
      \`revoked_at\` datetime(3) NULL,
      \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`), UNIQUE KEY \`UQ_RefreshSessions_token_hash\` (\`token_hash\`),
      KEY \`IDX_RefreshSessions_user_active\` (\`user_id\`,\`revoked_at\`),
      CONSTRAINT \`FK_RefreshSessions_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`UserAccounts\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `RefreshSessions`');
    await queryRunner.query('DROP TABLE `StudentProfiles`');
    await queryRunner.query('DROP TABLE `UserAccounts`');
    await queryRunner.query('DROP TABLE `Roles`');
  }
}
