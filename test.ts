import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { debtService } from './src/services/smart-debt.service';

async function main() {
  const result = await debtService.syncSnap({
    customerId: 4,
    year: 2026,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().finally(() => prisma.$disconnect());
