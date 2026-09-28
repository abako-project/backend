import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1787745721543 implements MigrationInterface {
    name = 'InitialSchema1787745721543'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "developers" ("id" SERIAL NOT NULL, "userId" text, "email" text, "name" character varying NOT NULL, "githubUsername" character varying NOT NULL, "portfolioUrl" character varying, "bio" character varying, "background" character varying, "proficiency" character varying NOT NULL DEFAULT 'junior', "location" character varying, "availability" character varying NOT NULL, "languages" text NOT NULL DEFAULT '[]', "availableHoursPerWeek" integer, "imageData" bytea, "imageMimeType" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_3cef899df27e32176b17ac73320" UNIQUE ("userId"), CONSTRAINT "UQ_c3b619f396a081afc995c856bdc" UNIQUE ("email"), CONSTRAINT "PK_247719240b950bd26dec14bdd21" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "clients" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "userId" text, "email" text, "company" character varying NOT NULL, "department" character varying NOT NULL, "website" character varying NOT NULL, "description" character varying NOT NULL, "location" character varying NOT NULL, "languages" text NOT NULL DEFAULT '[]', "imageData" bytea, "imageMimeType" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_59c1e5e51addd6ebebf76230b37" UNIQUE ("userId"), CONSTRAINT "UQ_b48860677afe62cd96e12659482" UNIQUE ("email"), CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" character varying, "summary" character varying, "projectType" integer, "state" character varying NOT NULL DEFAULT 'draft', "url" character varying, "budget" integer, "deliveryTime" integer, "deliveryDate" bigint, "proposalRejectionReason" character varying, "clientId" character varying NOT NULL, "consultantId" character varying, "contractAddress" character varying, "calendarContract" character varying, "coordinatorApprovalStatus" character varying, "coordinatorRejectionReason" character varying, "creationStatus" character varying NOT NULL DEFAULT 'created', "creationError" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_7c8dfd0308ee5d19114ce864239" UNIQUE ("contractAddress"), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "milestones" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "description" character varying, "budget" integer NOT NULL, "deliveryTime" integer NOT NULL, "deliveryDate" bigint, "displayOrder" integer NOT NULL DEFAULT '0', "contractAddress" character varying NOT NULL, "developerId" integer, "state" character varying NOT NULL DEFAULT 'pending', "rejectionReason" character varying, "requirements" text NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0bdbfe399c777a6a8520ff902d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_156a2e6338bb281c22d70eb14d" ON "milestones" ("contractAddress") `);
        await queryRunner.query(`CREATE TABLE "milestone_assignments" ("id" SERIAL NOT NULL, "projectId" character varying NOT NULL, "contractAddress" character varying NOT NULL, "milestoneId" integer NOT NULL, "developerId" integer NOT NULL, "accountId" character varying NOT NULL, "assignmentKey" text, "roleId" integer NOT NULL, "hours" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1f109bc3f6988013951b01f5fad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_43201607e27c8c95cb0c270163" ON "milestone_assignments" ("contractAddress", "milestoneId", "assignmentKey") `);
        await queryRunner.query(`CREATE INDEX "IDX_4f55c84608b23b59d89c0c2761" ON "milestone_assignments" ("developerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1db56cf81a93e13d32f5af729d" ON "milestone_assignments" ("contractAddress", "milestoneId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fae2d244a30382be2353c0c7b0" ON "milestone_assignments" ("projectId") `);
        await queryRunner.query(`CREATE TABLE "ratings" ("id" SERIAL NOT NULL, "projectId" character varying NOT NULL, "clientId" character varying NOT NULL, "developerId" character varying NOT NULL, "rating" integer NOT NULL, "contractAddress" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0f31425b073219379545ad68ed9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_74ea0c1baa797e62b76e90e9cb" ON "ratings" ("clientId", "developerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_bcbc72d958b4ecd1fa37845748" ON "ratings" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b70b74255662cbf608296e2ced" ON "ratings" ("developerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_32e834d46130d8c336e74afa21" ON "ratings" ("clientId") `);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventId" character varying NOT NULL, "recipientAddress" character varying NOT NULL, "type" character varying NOT NULL, "projectId" text, "data" text NOT NULL, "readAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0020f41bb5d42ef1823cf38c47" ON "notifications" ("recipientAddress", "readAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a49b1c431ac60be574cc95d6e8" ON "notifications" ("recipientAddress", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_a49b1c431ac60be574cc95d6e8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0020f41bb5d42ef1823cf38c47"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32e834d46130d8c336e74afa21"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b70b74255662cbf608296e2ced"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bcbc72d958b4ecd1fa37845748"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_74ea0c1baa797e62b76e90e9cb"`);
        await queryRunner.query(`DROP TABLE "ratings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fae2d244a30382be2353c0c7b0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1db56cf81a93e13d32f5af729d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f55c84608b23b59d89c0c2761"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_43201607e27c8c95cb0c270163"`);
        await queryRunner.query(`DROP TABLE "milestone_assignments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_156a2e6338bb281c22d70eb14d"`);
        await queryRunner.query(`DROP TABLE "milestones"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP TABLE "clients"`);
        await queryRunner.query(`DROP TABLE "developers"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
