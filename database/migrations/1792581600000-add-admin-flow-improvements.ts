import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminFlowImprovements1792581600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "reports_report_number_seq" START WITH 100`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "report_number" integer`,
    );
    await queryRunner.query(
      `UPDATE "reports" SET "report_number" = nextval('"reports_report_number_seq"') WHERE "report_number" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ALTER COLUMN "report_number" SET DEFAULT nextval('"reports_report_number_seq"')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ALTER COLUMN "report_number" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "UQ_reports_report_number" UNIQUE ("report_number")`,
    );
    await queryRunner.query(
      `ALTER TYPE "user_sessions_state_enum" ADD VALUE IF NOT EXISTS 'WAITING_ADMIN_COMMENT'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "UQ_reports_report_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN "report_number"`,
    );
    await queryRunner.query(`DROP SEQUENCE "reports_report_number_seq"`);

    await queryRunner.query(
      `CREATE TYPE "user_sessions_state_enum_old" AS ENUM ('IDLE', 'WAITING_FULL_NAME', 'WAITING_PHONE', 'WAITING_PHOTOS', 'WAITING_LOCATION', 'WAITING_ADDRESS_TEXT', 'WAITING_DESCRIPTION', 'WAITING_CONFIRMATION', 'WAITING_REJECTION_REASON')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ALTER COLUMN "state" TYPE "user_sessions_state_enum_old" USING "state"::text::"user_sessions_state_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "user_sessions_state_enum"`);
    await queryRunner.query(
      `ALTER TYPE "user_sessions_state_enum_old" RENAME TO "user_sessions_state_enum"`,
    );
  }
}
