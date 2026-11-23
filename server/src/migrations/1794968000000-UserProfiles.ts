import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserProfiles1794968000000 implements MigrationInterface {
  name = 'UserProfiles1794968000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `UserAccounts` ADD COLUMN `bio` varchar(500) NOT NULL DEFAULT '' AFTER `display_name`");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `UserAccounts` DROP COLUMN `bio`');
  }
}
