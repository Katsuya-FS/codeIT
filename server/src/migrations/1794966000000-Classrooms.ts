import { MigrationInterface, QueryRunner } from 'typeorm';

export class Classrooms1794966000000 implements MigrationInterface {
  name = 'Classrooms1794966000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE \`Classrooms\` (
      \`id\` char(36) NOT NULL, \`teacher_user_id\` char(36) NOT NULL,
      \`join_code\` varchar(24) NOT NULL, \`name\` varchar(120) NOT NULL,
      \`status\` varchar(16) NOT NULL DEFAULT 'active',
      \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`), UNIQUE KEY \`UQ_Classrooms_join_code\` (\`join_code\`),
      KEY \`IDX_Classrooms_teacher_status\` (\`teacher_user_id\`,\`status\`),
      CONSTRAINT \`FK_Classrooms_teacher\` FOREIGN KEY (\`teacher_user_id\`) REFERENCES \`TeacherProfiles\` (\`user_id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await q.query(`CREATE TABLE \`ClassroomJoinRequests\` (
      \`id\` char(36) NOT NULL, \`classroom_id\` char(36) NOT NULL, \`student_user_id\` char(36) NOT NULL,
      \`status\` varchar(16) NOT NULL DEFAULT 'pending', \`requested_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`decided_at\` datetime(3) NULL, \`decided_by_user_id\` char(36) NULL,
      PRIMARY KEY (\`id\`), KEY \`IDX_ClassroomJoinRequests_pair_status\` (\`classroom_id\`,\`student_user_id\`,\`status\`),
      CONSTRAINT \`FK_ClassroomJoinRequests_classroom\` FOREIGN KEY (\`classroom_id\`) REFERENCES \`Classrooms\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`FK_ClassroomJoinRequests_student\` FOREIGN KEY (\`student_user_id\`) REFERENCES \`StudentProfiles\` (\`user_id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`FK_ClassroomJoinRequests_decider\` FOREIGN KEY (\`decided_by_user_id\`) REFERENCES \`UserAccounts\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await q.query(`CREATE TABLE \`ClassroomMemberships\` (
      \`id\` char(36) NOT NULL, \`classroom_id\` char(36) NOT NULL, \`student_user_id\` char(36) NOT NULL,
      \`status\` varchar(16) NOT NULL DEFAULT 'active', \`joined_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`left_at\` datetime(3) NULL,
      PRIMARY KEY (\`id\`), KEY \`IDX_ClassroomMemberships_pair_status\` (\`classroom_id\`,\`student_user_id\`,\`status\`),
      KEY \`IDX_ClassroomMemberships_student_status\` (\`student_user_id\`,\`status\`),
      CONSTRAINT \`FK_ClassroomMemberships_classroom\` FOREIGN KEY (\`classroom_id\`) REFERENCES \`Classrooms\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`FK_ClassroomMemberships_student\` FOREIGN KEY (\`student_user_id\`) REFERENCES \`StudentProfiles\` (\`user_id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await q.query(`CREATE TABLE \`ClassroomActivities\` (
      \`id\` char(36) NOT NULL, \`classroom_id\` char(36) NOT NULL, \`challenge_id\` char(36) NOT NULL,
      \`created_by_user_id\` char(36) NOT NULL, \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`), KEY \`IDX_ClassroomActivities_classroom\` (\`classroom_id\`),
      CONSTRAINT \`FK_ClassroomActivities_classroom\` FOREIGN KEY (\`classroom_id\`) REFERENCES \`Classrooms\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`FK_ClassroomActivities_challenge\` FOREIGN KEY (\`challenge_id\`) REFERENCES \`CodingChallenges\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`FK_ClassroomActivities_creator\` FOREIGN KEY (\`created_by_user_id\`) REFERENCES \`UserAccounts\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `ClassroomActivities`');
    await q.query('DROP TABLE `ClassroomMemberships`');
    await q.query('DROP TABLE `ClassroomJoinRequests`');
    await q.query('DROP TABLE `Classrooms`');
  }
}
