import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherApproval1794960000000 implements MigrationInterface {
  name = 'TeacherApproval1794960000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`TeacherProfiles\` (
      \`user_id\` char(36) NOT NULL,
      \`approved_by_user_id\` char(36) NOT NULL,
      \`approved_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`user_id\`), KEY \`IDX_TeacherProfiles_approver\` (\`approved_by_user_id\`),
      CONSTRAINT \`FK_TeacherProfiles_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`UserAccounts\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`FK_TeacherProfiles_approver\` FOREIGN KEY (\`approved_by_user_id\`) REFERENCES \`UserAccounts\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`RoleChangeRequests\` (
      \`id\` char(36) NOT NULL,
      \`student_user_id\` char(36) NOT NULL,
      \`requested_role\` varchar(32) NOT NULL DEFAULT 'Teacher',
      \`status\` varchar(16) NOT NULL DEFAULT 'pending',
      \`reviewing_admin_user_id\` char(36) NULL,
      \`requested_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`decided_at\` datetime(3) NULL,
      PRIMARY KEY (\`id\`),
      KEY \`IDX_RoleChangeRequests_status_requested_at\` (\`status\`,\`requested_at\`),
      KEY \`IDX_RoleChangeRequests_student\` (\`student_user_id\`),
      KEY \`IDX_RoleChangeRequests_reviewer\` (\`reviewing_admin_user_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

    const studentFk = await queryRunner.query(
      'SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
      ['RoleChangeRequests', 'FK_RoleChangeRequests_student'],
    );
    if (!studentFk.length) {
      await queryRunner.query('ALTER TABLE `RoleChangeRequests` ADD CONSTRAINT `FK_RoleChangeRequests_student` FOREIGN KEY (`student_user_id`) REFERENCES `UserAccounts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE');
    }
    const reviewerFk = await queryRunner.query(
      'SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
      ['RoleChangeRequests', 'FK_RoleChangeRequests_reviewer'],
    );
    if (!reviewerFk.length) {
      await queryRunner.query('ALTER TABLE `RoleChangeRequests` ADD CONSTRAINT `FK_RoleChangeRequests_reviewer` FOREIGN KEY (`reviewing_admin_user_id`) REFERENCES `UserAccounts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE');
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `RoleChangeRequests`');
    await queryRunner.query('DROP TABLE `TeacherProfiles`');
  }
}
