import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherLessonSubmissions1794967000000 implements MigrationInterface {
  name = 'TeacherLessonSubmissions1794967000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`TeacherLessonSubmissions\` (
      \`id\` char(36) NOT NULL,
      \`teacher_user_id\` char(36) NOT NULL,
      \`module_id\` char(36) NOT NULL,
      \`title\` varchar(180) NOT NULL,
      \`description\` text NOT NULL,
      \`stored_file_name\` varchar(80) NOT NULL,
      \`original_file_name\` varchar(255) NOT NULL,
      \`file_size\` int unsigned NOT NULL,
      \`mime_type\` varchar(100) NOT NULL DEFAULT 'application/pdf',
      \`status\` varchar(16) NOT NULL DEFAULT 'pending',
      \`rejection_reason\` text NULL,
      \`reviewed_by_user_id\` char(36) NULL,
      \`reviewed_at\` datetime(3) NULL,
      \`published_lesson_id\` char(36) NULL,
      \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`UQ_TeacherLessonSubmissions_file\` (\`stored_file_name\`),
      UNIQUE KEY \`UQ_TeacherLessonSubmissions_published_lesson\` (\`published_lesson_id\`),
      KEY \`IDX_TeacherLessonSubmissions_teacher_created\` (\`teacher_user_id\`,\`created_at\`),
      KEY \`IDX_TeacherLessonSubmissions_status_created\` (\`status\`,\`created_at\`),
      CONSTRAINT \`FK_TeacherLessonSubmissions_teacher\` FOREIGN KEY (\`teacher_user_id\`) REFERENCES \`TeacherProfiles\` (\`user_id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`FK_TeacherLessonSubmissions_module\` FOREIGN KEY (\`module_id\`) REFERENCES \`CourseModules\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`FK_TeacherLessonSubmissions_reviewer\` FOREIGN KEY (\`reviewed_by_user_id\`) REFERENCES \`UserAccounts\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`FK_TeacherLessonSubmissions_lesson\` FOREIGN KEY (\`published_lesson_id\`) REFERENCES \`Lessons\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `TeacherLessonSubmissions`');
  }
}
