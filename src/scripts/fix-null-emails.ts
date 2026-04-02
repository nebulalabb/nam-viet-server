import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all users with null email
  const users = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM User WHERE email IS NULL OR email = ''
  `;

  console.log(`Found ${users.length} users with null/empty email`);

  for (const user of users) {
    const placeholderEmail = `no-email-${user.id}@internal.local`;
    await prisma.$executeRaw`
      UPDATE User SET email = ${placeholderEmail} WHERE id = ${user.id}
    `;
    console.log(`Fixed user #${user.id} -> ${placeholderEmail}`);
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
