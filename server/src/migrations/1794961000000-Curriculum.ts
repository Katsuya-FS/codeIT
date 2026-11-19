import { MigrationInterface, QueryRunner } from 'typeorm';

export class Curriculum1794961000000 implements MigrationInterface {
  name = 'Curriculum1794961000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`CourseModules\` (
      \`id\` char(36) NOT NULL, \`title\` varchar(160) NOT NULL, \`sequence\` int NOT NULL,
      \`status\` varchar(16) NOT NULL DEFAULT 'draft',
      \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`), UNIQUE KEY \`UQ_CourseModules_sequence\` (\`sequence\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE \`Lessons\` (
      \`id\` char(36) NOT NULL, \`module_id\` char(36) NOT NULL, \`title\` varchar(180) NOT NULL,
      \`sequence\` int NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'draft',
      PRIMARY KEY (\`id\`), UNIQUE KEY \`UQ_Lessons_module_sequence\` (\`module_id\`,\`sequence\`),
      CONSTRAINT \`FK_Lessons_module\` FOREIGN KEY (\`module_id\`) REFERENCES \`CourseModules\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE \`LessonVersions\` (
      \`id\` char(36) NOT NULL, \`lesson_id\` char(36) NOT NULL, \`version_number\` int NOT NULL,
      \`content\` longtext NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'draft', \`published_at\` datetime(3) NULL,
      PRIMARY KEY (\`id\`), UNIQUE KEY \`UQ_LessonVersions_lesson_version\` (\`lesson_id\`,\`version_number\`),
      CONSTRAINT \`FK_LessonVersions_lesson\` FOREIGN KEY (\`lesson_id\`) REFERENCES \`Lessons\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE \`LessonCompletions\` (
      \`id\` char(36) NOT NULL, \`student_user_id\` char(36) NOT NULL, \`lesson_version_id\` char(36) NOT NULL,
      \`completed_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`), UNIQUE KEY \`UQ_LessonCompletions_student_version\` (\`student_user_id\`,\`lesson_version_id\`),
      KEY \`IDX_LessonCompletions_version\` (\`lesson_version_id\`),
      CONSTRAINT \`FK_LessonCompletions_student\` FOREIGN KEY (\`student_user_id\`) REFERENCES \`StudentProfiles\` (\`user_id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`FK_LessonCompletions_version\` FOREIGN KEY (\`lesson_version_id\`) REFERENCES \`LessonVersions\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `LessonCompletions`');
    await queryRunner.query('DROP TABLE `LessonVersions`');
    await queryRunner.query('DROP TABLE `Lessons`');
    await queryRunner.query('DROP TABLE `CourseModules`');
  }
}
