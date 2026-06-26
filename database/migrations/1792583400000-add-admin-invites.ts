import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminInvites1792583400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_invites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "username" character varying(255) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "invited_by_user_id" uuid,
        "activated_user_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_invites_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_admin_invites_username" UNIQUE ("username")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "admin_invites" ADD CONSTRAINT "FK_admin_invites_invited_by_user" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_invites" ADD CONSTRAINT "FK_admin_invites_activated_user" FOREIGN KEY ("activated_user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_invites" DROP CONSTRAINT "FK_admin_invites_activated_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_invites" DROP CONSTRAINT "FK_admin_invites_invited_by_user"`,
    );
    await queryRunner.query(`DROP TABLE "admin_invites"`);
  }
}
