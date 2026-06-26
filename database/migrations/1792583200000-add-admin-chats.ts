import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminChats1792583200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_chats" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "telegram_chat_id" bigint NOT NULL,
        "title" character varying(255),
        "type" character varying(64) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by_user_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_chats_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_admin_chats_telegram_chat_id" UNIQUE ("telegram_chat_id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "admin_chats" ADD CONSTRAINT "FK_admin_chats_created_by_user" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_chats" DROP CONSTRAINT "FK_admin_chats_created_by_user"`,
    );
    await queryRunner.query(`DROP TABLE "admin_chats"`);
  }
}
