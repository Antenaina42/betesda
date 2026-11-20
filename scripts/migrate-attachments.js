const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    // Add columns to cashtransaction
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE cashtransaction ADD COLUMN attachmentUrl TEXT NULL;`);
      console.log('Added attachmentUrl to cashtransaction');
    } catch (e) {
      console.log('attachmentUrl on cashtransaction:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE cashtransaction ADD COLUMN attachmentName VARCHAR(255) NULL;`);
      console.log('Added attachmentName to cashtransaction');
    } catch (e) {
      console.log('attachmentName on cashtransaction:', e.message);
    }

    // Add columns to clinicmedicinerequisition
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE clinicmedicinerequisition ADD COLUMN attachmentUrl TEXT NULL;`);
      console.log('Added attachmentUrl to clinicmedicinerequisition');
    } catch (e) {
      console.log('attachmentUrl on clinicmedicinerequisition:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE clinicmedicinerequisition ADD COLUMN attachmentName VARCHAR(255) NULL;`);
      console.log('Added attachmentName to clinicmedicinerequisition');
    } catch (e) {
      console.log('attachmentName on clinicmedicinerequisition:', e.message);
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
