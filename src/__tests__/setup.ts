import { PrismaClient } from '@prisma/client';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
process.env.JWT_EXPIRE_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.BCRYPT_ROUNDS = '10';

// Global test setup
beforeAll(async () => {

});

// Clean up after all tests
afterAll(async () => {
  // Close database connections
  const prisma = new PrismaClient();
  await prisma.$disconnect();


});

// Reset data between tests if needed
afterEach(async () => {
  // Clear any test data or reset mocks
  jest.clearAllMocks();
});

// Export test utilities
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockUser = {
  id: 1,
  email: 'test@example.com',
  employeeCode: 'TEST001',
  fullName: 'Test User',
  roleId: 1,
  warehouseId: 1,
  status: 'active' as const,
};

export const mockAdmin = {
  id: 1,
  email: 'admin@example.com',
  employeeCode: 'ADMIN001',
  fullName: 'Admin User',
  roleId: 1,
  warehouseId: null,
  status: 'active' as const,
};

export const mockProduct = {
  id: 1,
  sku: 'PROD-001',
  productName: 'Test Product',
  productType: 'finished_product' as const,
  unit: 'pcs',
  purchasePrice: 100,
  sellingPriceRetail: 150,
  status: 'active' as const,
};

export const mockWarehouse = {
  id: 1,
  warehouseCode: 'WH-001',
  warehouseName: 'Main Warehouse',
  warehouseType: 'finished_product' as const,
  status: 'active' as const,
};

export const mockCustomer = {
  id: 1,
  customerCode: 'CUST-001',
  customerName: 'Test Customer',
  customerType: 'individual' as const,
  classification: 'retail' as const,
  phone: '0123456789',
  creditLimit: 10000000,
  currentDebt: 0,
  status: 'active' as const,
};
