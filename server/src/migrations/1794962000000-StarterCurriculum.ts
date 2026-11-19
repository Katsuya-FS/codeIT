import { MigrationInterface, QueryRunner } from 'typeorm';

export class StarterCurriculum1794962000000 implements MigrationInterface {
  name = 'StarterCurriculum1794962000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`INSERT INTO \`CourseModules\` (\`id\`,\`title\`,\`sequence\`,\`status\`) VALUES ('1ca87d83-e0be-4821-8d75-3a78602d9230','Java Foundations',1,'published')`);
    await queryRunner.query(`INSERT INTO \`Lessons\` (\`id\`,\`module_id\`,\`title\`,\`sequence\`,\`status\`) VALUES ('7d412583-d134-4c38-8c32-47116befd46e','1ca87d83-e0be-4821-8d75-3a78602d9230','Your first Java program',1,'published')`);
    await queryRunner.query(`INSERT INTO \`LessonVersions\` (\`id\`,\`lesson_id\`,\`version_number\`,\`content\`,\`status\`,\`published_at\`) VALUES ('ec2e0fae-59a8-49ae-b61e-e84fdb0035a0','7d412583-d134-4c38-8c32-47116befd46e',1,'Java programs are built from instructions the computer can compile and run. A Java source file uses the .java extension.\n\nYour first program\n\npublic class Welcome {\n    public static void main(String[] args) {\n        System.out.println("Hello, world!");\n    }\n}\n\nThe class name matches the file name: save this example as Welcome.java. The main method is where this program starts. println writes a line of text to the console.\n\nTry it\n\nChange the message inside the quotation marks. Then compile the file and run the program with a configured Java environment. CodeIT challenge execution will become available only after an isolated runner is configured.','published',CURRENT_TIMESTAMP(3))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DELETE FROM `LessonVersions` WHERE `id` = 'ec2e0fae-59a8-49ae-b61e-e84fdb0035a0' AND NOT EXISTS (SELECT 1 FROM `LessonCompletions` WHERE `lesson_version_id` = 'ec2e0fae-59a8-49ae-b61e-e84fdb0035a0')");
    await queryRunner.query("DELETE FROM `Lessons` WHERE `id` = '7d412583-d134-4c38-8c32-47116befd46e' AND NOT EXISTS (SELECT 1 FROM `LessonVersions` WHERE `lesson_id` = '7d412583-d134-4c38-8c32-47116befd46e')");
    await queryRunner.query("DELETE FROM `CourseModules` WHERE `id` = '1ca87d83-e0be-4821-8d75-3a78602d9230' AND NOT EXISTS (SELECT 1 FROM `Lessons` WHERE `module_id` = '1ca87d83-e0be-4821-8d75-3a78602d9230')");
  }
}
