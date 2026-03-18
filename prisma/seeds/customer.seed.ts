import { PrismaClient, Gender, CustomerType, CustomerStatus, AuthProvider } from '@prisma/client';
import bcrypt from 'bcrypt';

export async function seedCustomers(prisma: PrismaClient, adminUserId: number) {
  console.log('📝 Seeding customers...');

  // Group enums to ensure they match Prisma's expected casing
  // Note: Prisma enums are typically lowercase in this schema
  
  const passwordHash = await bcrypt.hash('customer123', 10);

  const customersData = [
    {
      customerCode: 'KH-0001',
      customerName: 'Nguyễn Văn A',
      customerType: 'individual' as CustomerType,
      gender: 'male' as Gender,
      phone: '0912345678',
      email: 'customer1@example.com',
      address: '123 Đường ABC, Quận 1, TP.HCM',
      status: 'active' as CustomerStatus,
      account: {
        accountIdentifier: '0912345678',
        authProvider: 'PHONE' as AuthProvider,
        passwordHash,
      },
      expiryAccounts: ['Tài khoản chính', 'Tài khoản khuyến mãi']
    },
    {
      customerCode: 'KH-0002',
      customerName: 'Trần Thị B',
      customerType: 'individual' as CustomerType,
      gender: 'female' as Gender,
      phone: '0987654321',
      email: 'customer2@example.com',
      address: '456 Đường XYZ, Quận 3, TP.HCM',
      status: 'active' as CustomerStatus,
      account: {
        accountIdentifier: 'customer2@example.com',
        authProvider: 'GOOGLE' as AuthProvider,
        passwordHash,
      }
    },
    {
      customerCode: 'KH-0003',
      customerName: 'Công ty TNHH MTV Nam Việt',
      customerType: 'company' as CustomerType,
      contactPerson: 'Ông Lê Văn C',
      phone: '02833334444',
      email: 'contact@namviet.com',
      address: '789 Đường LMN, Quận Tân Bình, TP.HCM',
      taxCode: '0101234567',
      status: 'active' as CustomerStatus,
      creditLimit: 50000000,
    }
  ];

  for (const data of customersData) {
    const { account, expiryAccounts, ...customerInfo } = data;
    
    const customer = await prisma.customer.upsert({
      where: { customerCode: customerInfo.customerCode },
      update: {},
      create: {
        ...customerInfo,
        createdBy: adminUserId,
        assignedUserId: adminUserId,
      },
    });

    if (account) {
      await prisma.customerAccount.upsert({
        where: { customerId: customer.id },
        update: {},
        create: {
          ...account,
          customerId: customer.id,
          isVerified: true,
        },
      });
    }

    if (expiryAccounts) {
      for (const name of expiryAccounts) {
        // Find or create expiry account
        await prisma.customerExpiryAccount.create({
          data: {
            customerId: customer.id,
            accountName: name,
          }
        });
      }
    }
  }

  console.log(`✅ Seeded ${customersData.length} customers\n`);
}
