import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTelegramBotMvpTables1792580800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(
      `CREATE TYPE "users_language_enum" AS ENUM ('ru', 'kk')`,
    );
    await queryRunner.query(
      `CREATE TYPE "users_role_enum" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "user_sessions_state_enum" AS ENUM ('IDLE', 'WAITING_FULL_NAME', 'WAITING_PHONE', 'WAITING_PHOTOS', 'WAITING_LOCATION', 'WAITING_ADDRESS_TEXT', 'WAITING_DESCRIPTION', 'WAITING_CONFIRMATION', 'WAITING_REJECTION_REASON')`,
    );
    await queryRunner.query(
      `CREATE TYPE "reports_status_enum" AS ENUM ('DRAFT', 'NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CANCELLED')`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "telegram_id" bigint`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_telegram_id" UNIQUE ("telegram_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "username" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "first_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "last_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "language" "users_language_enum" NOT NULL DEFAULT 'ru'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "full_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phone" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" "users_role_enum" NOT NULL DEFAULT 'USER'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "is_blocked" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "author_id" uuid NOT NULL,
        "status" "reports_status_enum" NOT NULL DEFAULT 'DRAFT',
        "description" character varying(1000),
        "address_text" character varying(1000),
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "admin_comment" character varying(1000),
        "rejection_reason" character varying(255),
        "assigned_admin_id" uuid,
        "admin_message_id" integer,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "submitted_at" timestamp,
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "resolved_at" timestamp,
        "cancelled_at" timestamp,
        CONSTRAINT "PK_reports_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "state" "user_sessions_state_enum" NOT NULL DEFAULT 'IDLE',
        "current_report_id" uuid,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_sessions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "report_photos" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "report_id" uuid NOT NULL,
        "telegram_file_id" character varying(255) NOT NULL,
        "telegram_file_unique_id" character varying(255),
        "r2_bucket" character varying(255) NOT NULL,
        "r2_key" character varying(1000) NOT NULL,
        "r2_url" character varying(1000),
        "mime_type" character varying(255),
        "size_bytes" integer,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_photos_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "report_status_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "report_id" uuid NOT NULL,
        "from_status" "reports_status_enum",
        "to_status" "reports_status_enum" NOT NULL,
        "changed_by_user_id" uuid,
        "comment" character varying(1000),
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_status_history_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_reports_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_reports_assigned_admin" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_user_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_user_sessions_current_report" FOREIGN KEY ("current_report_id") REFERENCES "reports"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_photos" ADD CONSTRAINT "FK_report_photos_report" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_status_history" ADD CONSTRAINT "FK_report_status_history_report" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_status_history" ADD CONSTRAINT "FK_report_status_history_changed_by_user" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report_status_history" DROP CONSTRAINT "FK_report_status_history_changed_by_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_status_history" DROP CONSTRAINT "FK_report_status_history_report"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_photos" DROP CONSTRAINT "FK_report_photos_report"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_user_sessions_current_report"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_user_sessions_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_reports_assigned_admin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_reports_author"`,
    );

    await queryRunner.query(`DROP TABLE "report_status_history"`);
    await queryRunner.query(`DROP TABLE "report_photos"`);
    await queryRunner.query(`DROP TABLE "user_sessions"`);
    await queryRunner.query(`DROP TABLE "reports"`);

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_blocked"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "full_name"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "language"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_name"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "first_name"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_users_telegram_id"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "telegram_id"`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT`,
    );

    await queryRunner.query(`DROP TYPE "reports_status_enum"`);
    await queryRunner.query(`DROP TYPE "user_sessions_state_enum"`);
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
    await queryRunner.query(`DROP TYPE "users_language_enum"`);
  }
}
