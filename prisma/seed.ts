import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding database...');

  // ── Organization ─────────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { email: 'info@adarshinfra.co.in' },
    update: {},
    create: {
      name: 'Adarsh Infradevelopers & Construction',
      email: 'info@adarshinfra.co.in',
      phone: '9000000000',
      address: 'Lucknow',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      status: 'ACTIVE',
    },
  });
  console.log(`✅  Organization: ${org.name} (${org.id})`);

  // Write ORG_ID to console so it can be added to .env
  console.log(`\n👉  Add this to your .env file:\nDEFAULT_ORG_ID=${org.id}\n`);

  // ── Owner account ─────────────────────────────────────────────────────────────
  const ownerPasswordHash = await bcrypt.hash('owner@123', 12);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@adarshinfra.co.in' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Akash Verma',
      email: 'owner@adarshinfra.co.in',
      phone: '9000000001',
      passwordHash: ownerPasswordHash,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });
  console.log(`✅  Owner: ${owner.name} (${owner.email})`);

  // ── Default property ──────────────────────────────────────────────────────────
  const property = await prisma.property.upsert({
    where: { id: 'clproperty001' },
    update: {},
    create: {
      id: 'clproperty001',
      organizationId: org.id,
      name: 'Adarsh Residency',
      address: 'Gomti Nagar',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      postalCode: '226010',
      status: 'ACTIVE',
    },
  });
  console.log(`✅  Property: ${property.name}`);

  // ── Sample units ──────────────────────────────────────────────────────────────
  const unitData = [
    { unitNumber: '101', monthlyRent: 8000, rentDueDay: 5 },
    { unitNumber: '102', monthlyRent: 8500, rentDueDay: 5 },
    { unitNumber: '103', monthlyRent: 9000, rentDueDay: 5 },
    { unitNumber: '201', monthlyRent: 10000, rentDueDay: 5 },
    { unitNumber: '202', monthlyRent: 10500, rentDueDay: 5 },
  ];

  for (const u of unitData) {
    const existing = await prisma.unit.findFirst({
      where: { propertyId: property.id, unitNumber: u.unitNumber },
    });
    if (!existing) {
      await prisma.unit.create({
        data: { propertyId: property.id, ...u, status: 'AVAILABLE' },
      });
    }
  }
  console.log(`✅  ${unitData.length} units seeded`);

  // ── Default electricity rate ──────────────────────────────────────────────────
  const existingRate = await prisma.electricitySetting.findFirst();
  if (!existingRate) {
    await prisma.electricitySetting.create({
      data: { ratePerUnit: 6.5 },
    });
    console.log('✅  Default electricity rate: ₹6.50/unit');
  }

  console.log('\n🎉  Seed complete!');
  console.log('────────────────────────────────────────────');
  console.log('  Owner login credentials:');
  console.log('  Email   : owner@adarshinfra.co.in');
  console.log('  Password: owner@123');
  console.log('────────────────────────────────────────────');
}

main()
  .catch((err) => {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
