PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO users VALUES('cmopvgp650000x4lgk9861fle','mike.jung.privat@gmail.com','$2a$10$4a5S2Rd3b0gKANiads2N2.cwEZt.0vYY2o7XV9dDdHCeNzE28QXWe','mike.jung.privat',NULL,NULL,'ACTIVE',NULL,'2026-05-04T19:38:06.160+00:00','2026-05-03T14:34:47.789+00:00','2026-05-04T19:38:06.161+00:00');
INSERT INTO users VALUES('cmopych92000113odxu4ua4ws','siefert-tom@web.de','$2a$10$yskraAFClmKe5RHSjjSDKuSk9b9jP4nfCaxQdESznjc7B7nLR4pX2','Tom Siefert',NULL,NULL,'ACTIVE','cmopvgp650000x4lgk9861fle',NULL,'2026-05-03T15:55:29.751+00:00','2026-05-03T15:55:29.751+00:00');
INSERT INTO users VALUES('cmorf2tpa0001vuvt6keczh8s','hausservice-baerenstark@outlook.com','$2a$10$C0Gflw7xVyg8jiNI6fimXeQExR63jpQFGGLYkZ5JkiOWj9GhDUWFu','Tom Siefert',NULL,NULL,'ACTIVE','cmopvgp650000x4lgk9861fle','2026-05-04T20:24:28.086+00:00','2026-05-04T16:31:38.974+00:00','2026-05-04T20:24:28.087+00:00');
CREATE TABLE IF NOT EXISTS "customer_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" DATETIME,
    "verificationToken" TEXT,
    "verificationTokenExpiry" DATETIME,
    "oauthProvider" TEXT,
    "oauthId" TEXT,
    "avatarUrl" TEXT,
    "adminNote" TEXT,
    "adminRating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
, "city" TEXT, "postalCode" TEXT, "streetAndNumber" TEXT, "unsubscribedAt"     DATETIME, "unsubscribedReason" TEXT);
INSERT INTO customer_users VALUES('cmorcuxsm0000f3521ymv9lhq','mike.jung.privat@gmail.com',NULL,'Mike','Jung',NULL,1,NULL,NULL,NULL,'google','108044243477275176353','https://lh3.googleusercontent.com/a/ACg8ocKxuH3ogTd-PVWQ4ccPkO3YHc6nVem3etNle4X0ooLjquEzXDY=s96-c','Guter Kerl!',5,'2026-05-04T15:29:31.799+00:00','2026-05-04T19:41:05.196+00:00','Darmstadt','64293','Evenaristrasse 62',NULL,NULL);
INSERT INTO customer_users VALUES('cmorfsexv0000j4xsoc0kq9lg','ninahome406@gmail.com',NULL,'Nina','Jung',NULL,1,NULL,NULL,NULL,'google','103097526715517627861','https://lh3.googleusercontent.com/a/ACg8ocJhtRkjcgMgaRc2GErwt4fumKvQr62HOpMekhcpe8f20uggNg=s96-c',NULL,NULL,'2026-05-04T16:51:32.900+00:00','2026-05-04T16:51:48.799+00:00','Darmstadt','64291','Im Hilsbruch 43',NULL,NULL);
INSERT INTO customer_users VALUES('cmorihluv0000snw9cszy7go5','mike19041990@hotmail.com',NULL,'Mik','Si',NULL,1,NULL,NULL,NULL,'facebook','10174856001785454','https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=10174856001785454&height=50&width=50&ext=1780510026&hash=AT95Vlu-WMxG5DFEkcD8B1Fb','Arrogant! aber zahlt gut',2,'2026-05-04T18:07:07.495+00:00','2026-05-04T19:41:25.698+00:00',NULL,NULL,NULL,NULL,NULL);
INSERT INTO customer_users VALUES('cmorkdjgb00004y4j1rhbzknl','mike.siefert.privat@gmail.com',NULL,'Mike','Siefert','017664750232',1,NULL,NULL,NULL,'google','112705156266069699478','https://lh3.googleusercontent.com/a/ACg8ocIDYbCgoHr7mlwi6aiTh5llEPn0jTC51gqVEA14hgLRslBICLhw=s96-c',NULL,NULL,'2026-05-04T18:59:56.987+00:00','2026-05-04T19:00:18.684+00:00','Darmstadt','64293','Evenaristraße 62',NULL,NULL);
INSERT INTO customer_users VALUES('cmorn90b0000011p26x3zcgb2','mike.siefert.privat2@gmail.com',NULL,'Mike','Siefert',NULL,1,NULL,NULL,NULL,'google','113122352752721065237','https://lh3.googleusercontent.com/a/ACg8ocJlNJqlgUrBxNuonfvpam_VDzIf6GedkqAshgNWyfVKhDypkQ=s96-c',NULL,NULL,'2026-05-04T20:20:24.397+00:00','2026-05-04T20:20:24.397+00:00',NULL,NULL,NULL,NULL,NULL);
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "slots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);
CREATE TABLE IF NOT EXISTS "bookings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slotId" TEXT,
    "date" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "service" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "addressStreet" TEXT,
    "addressZip" TEXT,
    "addressCity" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "mailSent" BOOLEAN NOT NULL DEFAULT false,
    "mailError" TEXT,
    "cancelToken" TEXT NOT NULL,
    "counterProposalSlotId" TEXT,
    "finalPriceEur" DECIMAL,
    "finalPriceNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "cancelledAt" DATETIME, "cancelledBy" TEXT, "cancellationReason" TEXT,
    CONSTRAINT "bookings_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "slots" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bookings_counterProposalSlotId_fkey" FOREIGN KEY ("counterProposalSlotId") REFERENCES "slots" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO bookings VALUES('cmorjrg37000510emxfzzpya7',NULL,'2026-05-07','10:00','15:00',300,'cmorcuxsm0000f3521ymv9lhq','Mike Siefert','017664750232','mike.siefert.privat@gmail.com','entruempelung','Test Auftrag lets see if its fixed','Evenaristrasse 62','64293','Darmstadt','REJECTED',1,NULL,'cmorjrg37000610empqjlc6yl',NULL,400,'Mega klappt','2026-05-04T18:42:46.195+00:00','2026-05-04T18:47:58.962+00:00',NULL,NULL,NULL);
INSERT INTO bookings VALUES('cmork32ar00058lf0wnyekp1e',NULL,'2026-05-28','15:00','17:00',120,'cmorcuxsm0000f3521ymv9lhq','Mike Jung','017664750232','mike.jung.privat@gmail.com','entruempelung','Das ist ein Test','Evenaristrasse 62','64293','Darmstadt','COMPLETED',1,NULL,'cmork32ar00068lf04jn2los0',NULL,150,NULL,'2026-05-04T18:51:48.195+00:00','2026-05-04T18:54:47.200+00:00',NULL,NULL,NULL);
INSERT INTO bookings VALUES('cmorknhbq0003n8tibszzi131',NULL,'2026-05-06','09:00','14:00',300,'cmorkdjgb00004y4j1rhbzknl','Mike Siefert','+4917664750232','mike.siefert.privat@gmail.com','muelltonnenservice','Test Auftrag','Im Hilsbruch 43','64291','Darmstadt','CONFIRMED',1,NULL,'cmorknhbq0004n8tiy54arled',NULL,2000,NULL,'2026-05-04T19:07:40.790+00:00','2026-05-04T19:13:23.872+00:00',NULL,NULL,NULL);
INSERT INTO bookings VALUES('cmorlp2nl000an8tirubcfcej',NULL,'2026-05-06','15:00','17:00',120,'cmorcuxsm0000f3521ymv9lhq','Mike Jung','017664750232','mike.jung.privat@gmail.com','entruempelung','Hallo ich brauche ... HDL Bruder','Evenaristrasse 62','64293','Darmstadt','PENDING',1,NULL,'cmorlp2nl000bn8tieaiffuil',NULL,NULL,NULL,'2026-05-04T19:36:54.705+00:00','2026-05-04T19:36:55.194+00:00',NULL,NULL,NULL);
CREATE TABLE IF NOT EXISTS "availability_template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayOfWeek" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT NOT NULL DEFAULT '08:00',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO availability_template VALUES('cmopwh8x40000ru0unsjqmmxv',0,0,'08:00','17:00',60,'2026-05-03T15:56:20.902+00:00');
INSERT INTO availability_template VALUES('cmopwh8x40001ru0u3kx3xkts',1,1,'08:00','17:00',60,'2026-05-03T15:56:20.902+00:00');
INSERT INTO availability_template VALUES('cmopwh8x40002ru0uhj6r0rhx',2,1,'08:00','17:00',60,'2026-05-03T15:56:20.902+00:00');
INSERT INTO availability_template VALUES('cmopwh8x40003ru0uu3m511wn',3,1,'08:00','17:00',60,'2026-05-03T15:56:20.902+00:00');
INSERT INTO availability_template VALUES('cmopwh8x40004ru0u5yjqcm2t',4,1,'08:00','17:00',60,'2026-05-03T15:56:20.902+00:00');
INSERT INTO availability_template VALUES('cmopwh8x40005ru0uo56ojmxu',5,1,'08:00','17:00',60,'2026-05-03T15:56:20.902+00:00');
INSERT INTO availability_template VALUES('cmopwh8x40006ru0uom0ir5px',6,0,'08:00','17:00',60,'2026-05-03T15:56:20.902+00:00');
CREATE TABLE IF NOT EXISTS "day_overrides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO day_overrides VALUES('cmopwmu180007zfdyl9robvz2','2026-05-09',0,NULL,NULL,'Test Urlaub','2026-05-03T15:07:33.645+00:00','2026-05-03T15:07:33.645+00:00');
INSERT INTO day_overrides VALUES('cmopwn1qn0008zfdyus2ax4yi','2026-05-14',0,NULL,NULL,'Arbeit','2026-05-03T15:07:43.631+00:00','2026-05-03T15:07:43.631+00:00');
CREATE TABLE IF NOT EXISTS "booking_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_attachments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO booking_attachments VALUES('cmorjqaru0001b25xqmlymkbs',NULL,'','IMG_8700.jpg','image/jpeg',267515,'2026-05-04T18:41:52.647+00:00');
INSERT INTO booking_attachments VALUES('cmorjr2fg00014bzj2zzmiqw3',NULL,'','IMG_8701.jpg','image/jpeg',205994,'2026-05-04T18:42:28.489+00:00');
INSERT INTO booking_attachments VALUES('cmorjr2vh000110emlmalvlff',NULL,'','IMG_8705.jpg','image/jpeg',113541,'2026-05-04T18:42:29.066+00:00');
INSERT INTO booking_attachments VALUES('cmork12yw000910emlztc6bku',NULL,'','IMG_8704.jpg','image/jpeg',134108,'2026-05-04T18:50:15.753+00:00');
INSERT INTO booking_attachments VALUES('cmork12zi0001y2v56rnwh8rr',NULL,'','IMG_8701.jpg','image/jpeg',205994,'2026-05-04T18:50:15.774+00:00');
INSERT INTO booking_attachments VALUES('cmork12zj00018lf085vho3fy',NULL,'','IMG_8703.jpg','image/jpeg',137803,'2026-05-04T18:50:15.775+00:00');
CREATE TABLE IF NOT EXISTS "weekly_availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayOfWeek" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO weekly_availability VALUES('cmoril9ep00008n4r97ve0uv7',0,0,'2026-05-04T18:09:57.984+00:00','2026-05-04T18:09:57.984+00:00');
INSERT INTO weekly_availability VALUES('cmoril9ep00018n4rbyaey1kg',1,0,'2026-05-04T18:09:57.984+00:00','2026-05-04T18:09:57.984+00:00');
INSERT INTO weekly_availability VALUES('cmoril9ep00028n4rq8usowa3',2,0,'2026-05-04T18:09:57.984+00:00','2026-05-04T18:09:57.984+00:00');
INSERT INTO weekly_availability VALUES('cmoril9ep00038n4rzk9qhdz7',3,0,'2026-05-04T18:09:57.984+00:00','2026-05-04T18:09:57.984+00:00');
INSERT INTO weekly_availability VALUES('cmoril9ep00048n4rztu41pox',4,0,'2026-05-04T18:09:57.984+00:00','2026-05-04T18:09:57.984+00:00');
INSERT INTO weekly_availability VALUES('cmoril9ep00058n4r48hkwdln',5,0,'2026-05-04T18:09:57.984+00:00','2026-05-04T18:09:57.984+00:00');
INSERT INTO weekly_availability VALUES('cmoril9ep00068n4rq7skwon5',6,0,'2026-05-04T18:09:57.984+00:00','2026-05-04T18:09:57.984+00:00');
CREATE TABLE IF NOT EXISTS "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO payments VALUES('cmork6bxr0003y2v5rh4dcy0y','cmork32ar00058lf0wnyekp1e',NULL,10000,'eur','Bruder','PENDING',NULL,'2026-05-04T18:54:20.655+00:00','2026-05-04T18:54:20.655+00:00');
CREATE TABLE IF NOT EXISTS "reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "bookingId" TEXT,
    "stars" INTEGER NOT NULL,
    "text" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "rejectedAt" DATETIME,
    "moderatedById" TEXT,
    "moderatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reviews_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "buffer_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO buffer_config VALUES('cmopvr7qd0000k92rlojopxsz',30,'2026-05-03T14:42:58.405+00:00');
CREATE TABLE IF NOT EXISTS "marketing_emails" (
  "id"             TEXT PRIMARY KEY,
  "sentByAdminId"  TEXT NOT NULL,
  "subject"        TEXT NOT NULL,
  "bodyText"       TEXT NOT NULL,
  "filterServices" TEXT NOT NULL,
  "recipientCount" INTEGER NOT NULL,
  "successCount"   INTEGER NOT NULL DEFAULT 0,
  "failureCount"   INTEGER NOT NULL DEFAULT 0,
  "status"         TEXT NOT NULL DEFAULT 'draft',
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"    DATETIME,
  CONSTRAINT "marketing_emails_sentByAdmin_fk"
    FOREIGN KEY ("sentByAdminId") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS "marketing_email_recipients" (
  "id"               TEXT PRIMARY KEY,
  "marketingEmailId" TEXT NOT NULL,
  "customerId"       TEXT NOT NULL,
  "email"            TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'PENDING',
  "resendMessageId"  TEXT,
  "errorMessage"     TEXT,
  "sentAt"           DATETIME,
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mer_marketingEmail_fk"
    FOREIGN KEY ("marketingEmailId") REFERENCES "marketing_emails"("id") ON DELETE CASCADE,
  CONSTRAINT "mer_customer_fk"
    FOREIGN KEY ("customerId") REFERENCES "customer_users"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id"        TEXT PRIMARY KEY,
  "key"       TEXT NOT NULL UNIQUE,
  "scope"     TEXT,
  "response"  TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_resetToken_key" ON "users"("resetToken");
CREATE INDEX "users_status_idx" ON "users"("status");
CREATE UNIQUE INDEX "customer_users_email_key" ON "customer_users"("email");
CREATE UNIQUE INDEX "customer_users_verificationToken_key" ON "customer_users"("verificationToken");
CREATE INDEX "customer_users_email_idx" ON "customer_users"("email");
CREATE INDEX "customer_users_oauthProvider_oauthId_idx" ON "customer_users"("oauthProvider", "oauthId");
CREATE INDEX "customer_users_lastName_firstName_idx" ON "customer_users"("lastName", "firstName");
CREATE INDEX "customer_users_adminRating_idx" ON "customer_users"("adminRating");
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_customerId_expiresAt_idx" ON "password_reset_tokens"("customerId", "expiresAt");
CREATE INDEX "slots_startsAt_idx" ON "slots"("startsAt");
CREATE INDEX "slots_startsAt_endsAt_idx" ON "slots"("startsAt", "endsAt");
CREATE INDEX "slots_deletedAt_idx" ON "slots"("deletedAt");
CREATE UNIQUE INDEX "bookings_cancelToken_key" ON "bookings"("cancelToken");
CREATE INDEX "bookings_slotId_idx" ON "bookings"("slotId");
CREATE INDEX "bookings_status_createdAt_idx" ON "bookings"("status", "createdAt");
CREATE INDEX "bookings_counterProposalSlotId_idx" ON "bookings"("counterProposalSlotId");
CREATE INDEX "bookings_date_status_idx" ON "bookings"("date", "status");
CREATE INDEX "bookings_status_date_startTime_idx" ON "bookings"("status", "date", "startTime");
CREATE INDEX "bookings_customerId_date_idx" ON "bookings"("customerId", "date");
CREATE INDEX "bookings_customerId_status_idx" ON "bookings"("customerId", "status");
CREATE UNIQUE INDEX "availability_template_dayOfWeek_key" ON "availability_template"("dayOfWeek");
CREATE INDEX "availability_template_dayOfWeek_idx" ON "availability_template"("dayOfWeek");
CREATE UNIQUE INDEX "day_overrides_date_key" ON "day_overrides"("date");
CREATE INDEX "day_overrides_date_idx" ON "day_overrides"("date");
CREATE INDEX "booking_attachments_bookingId_idx" ON "booking_attachments"("bookingId");
CREATE UNIQUE INDEX "weekly_availability_dayOfWeek_key" ON "weekly_availability"("dayOfWeek");
CREATE INDEX "weekly_availability_dayOfWeek_idx" ON "weekly_availability"("dayOfWeek");
CREATE UNIQUE INDEX "payments_bookingId_key" ON "payments"("bookingId");
CREATE UNIQUE INDEX "payments_stripeSessionId_key" ON "payments"("stripeSessionId");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_stripeSessionId_idx" ON "payments"("stripeSessionId");
CREATE UNIQUE INDEX "reviews_bookingId_key" ON "reviews"("bookingId");
CREATE INDEX "reviews_approved_createdAt_idx" ON "reviews"("approved", "createdAt");
CREATE INDEX "reviews_approved_rejectedAt_createdAt_idx" ON "reviews"("approved", "rejectedAt", "createdAt");
CREATE INDEX "reviews_customerId_idx" ON "reviews"("customerId");
CREATE INDEX "customer_users_unsubscribedAt_idx" ON "customer_users"("unsubscribedAt");
CREATE INDEX "marketing_emails_sentByAdmin_createdAt_idx"
  ON "marketing_emails"("sentByAdminId", "createdAt");
CREATE INDEX "marketing_emails_status_createdAt_idx"
  ON "marketing_emails"("status", "createdAt");
CREATE INDEX "mer_marketingEmail_status_idx"
  ON "marketing_email_recipients"("marketingEmailId", "status");
CREATE INDEX "mer_customer_idx"
  ON "marketing_email_recipients"("customerId");
CREATE INDEX "mer_sentAt_idx"
  ON "marketing_email_recipients"("sentAt");
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");
COMMIT;
