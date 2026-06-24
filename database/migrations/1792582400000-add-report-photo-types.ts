import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportPhotoTypes1792582400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "report_photos_photo_type_enum" AS ENUM ('USER_REPORT', 'ADMIN_COMPLETION')`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_photos" ADD "photo_type" "report_photos_photo_type_enum" NOT NULL DEFAULT 'USER_REPORT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_photos" ADD "uploaded_by_user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_photos" ADD CONSTRAINT "FK_report_photos_uploaded_by_user" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "user_sessions_state_enum" ADD VALUE IF NOT EXISTS 'WAITING_COMPLETION_PHOTOS'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report_photos" DROP CONSTRAINT "FK_report_photos_uploaded_by_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_photos" DROP COLUMN "uploaded_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_photos" DROP COLUMN "photo_type"`,
    );
    await queryRunner.query(`DROP TYPE "report_photos_photo_type_enum"`);

    await queryRunner.query(
      `CREATE TYPE "user_sessions_state_enum_old" AS ENUM ('IDLE', 'WAITING_FULL_NAME', 'WAITING_PHONE', 'WAITING_PHOTOS', 'WAITING_LOCATION', 'WAITING_ADDRESS_TEXT', 'WAITING_DESCRIPTION', 'WAITING_CONFIRMATION', 'WAITING_REJECTION_REASON', 'WAITING_ADMIN_COMMENT')`,
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
