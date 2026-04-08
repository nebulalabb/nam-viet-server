import { PrismaClient } from '@prisma/client';

export async function seedDebt(prisma: PrismaClient) {
  console.log('📝 Seeding customer debt data...');

  const customers = await prisma.customer.findMany({ take: 5 });

  if (customers.length === 0) {
    console.log('⚠️  No customers found to add debt');
    return;
  }

  // Nợ dữ liệu thực tế cho 5 khách hàng
  const debtData = [
    {
      customerName: customers[0]?.customerName || 'Khách hàng 1',
      openingBalance: 5000000, // 5 triệu
      increasingAmount: 3000000, // +3 triệu (mua hàng)
      decreasingAmount: 2000000, // -2 triệu (trả nợ)
      returnAmount: 500000, // 500k hàng trả lại
      adjustmentAmount: 0,
      closingBalance: 5500000, // Dư cuối
    },
    {
      customerName: customers[1]?.customerName || 'Khách hàng 2',
      openingBalance: 8000000, // 8 triệu
      increasingAmount: 5000000, // +5 triệu
      decreasingAmount: 3000000, // -3 triệu
      returnAmount: 1000000, // 1 triệu
      adjustmentAmount: 200000, // Điều chỉnh +200k
      closingBalance: 9200000, // Dư cuối
    },
    {
      customerName: customers[2]?.customerName || 'Khách hàng 3',
      openingBalance: 12000000, // 12 triệu
      increasingAmount: 8000000, // +8 triệu
      decreasingAmount: 6000000, // -6 triệu
      returnAmount: 2000000, // 2 triệu
      adjustmentAmount: -500000, // Điều chỉnh -500k
      closingBalance: 11500000, // Dư cuối
    },
    {
      customerName: customers[3]?.customerName || 'Khách hàng 4',
      openingBalance: 3000000, // 3 triệu
      increasingAmount: 2000000, // +2 triệu
      decreasingAmount: 1000000, // -1 triệu
      returnAmount: 300000, // 300k
      adjustmentAmount: 100000, // Điều chỉnh +100k
      closingBalance: 3800000, // Dư cuối
    },
    {
      customerName: customers[4]?.customerName || 'Khách hàng 5',
      openingBalance: 15000000, // 15 triệu
      increasingAmount: 10000000, // +10 triệu
      decreasingAmount: 8000000, // -8 triệu
      returnAmount: 3000000, // 3 triệu
      adjustmentAmount: 1000000, // Điều chỉnh +1 triệu
      closingBalance: 15000000, // Dư cuối
    },
  ];

  let createdCount = 0;

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const debt = debtData[i];

    await prisma.debtPeriod.upsert({
      where: {
        customerId_periodName: {
          customerId: customer.id,
          periodName: '2024',
        },
      },
      update: {
        openingBalance: debt.openingBalance,
        increasingAmount: debt.increasingAmount,
        decreasingAmount: debt.decreasingAmount,
        returnAmount: debt.returnAmount,
        adjustmentAmount: debt.adjustmentAmount,
        closingBalance: debt.closingBalance,
      },
      create: {
        customerId: customer.id,
        periodName: '2024',
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-12-31'),
        openingBalance: debt.openingBalance,
        increasingAmount: debt.increasingAmount,
        decreasingAmount: debt.decreasingAmount,
        returnAmount: debt.returnAmount,
        adjustmentAmount: debt.adjustmentAmount,
        closingBalance: debt.closingBalance,
        isLocked: false,
        notes: `Công nợ năm 2024 - ${debt.customerName}`,
      },
    });

    createdCount++;
    console.log(`   ✓ ${debt.customerName}: ${debt.closingBalance.toLocaleString('vi-VN')} VND`);
  }

  console.log(`\n✅ Added debt for ${createdCount} customers\n`);
}
