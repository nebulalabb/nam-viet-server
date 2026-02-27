import { PrismaClient } from '@prisma/client';
import inventoryService from '@services/inventory.service';

// Mock Prisma
jest.mock('@prisma/client');

describe('InventoryService Unit Tests', () => {
  let prisma: any;

  beforeEach(() => {
    // Create a fresh mock for each test
    prisma = {
      inventory: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      warehouse: {
        findUnique: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
    };

    // Mock PrismaClient constructor
    (PrismaClient as jest.MockedClass<typeof PrismaClient>).mockImplementation(() => prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return inventory list with correct calculations', async () => {
      const mockInventory = [
        {
          id: 1,
          warehouseId: 1,
          productId: 1,
          quantity: 100,
          reservedQuantity: 20,
          warehouse: {
            id: 1,
            warehouseName: 'Test Warehouse',
            warehouseCode: 'WH001',
            warehouseType: 'finished_product',
          },
          product: {
            id: 1,
            sku: 'PROD001',
            productName: 'Test Product',
            productType: 'finished_product',
            unit: 'pcs',
            minStockLevel: 10,
            status: 'active',
            category: {
              id: 1,
              categoryName: 'Test Category',
              categoryCode: 'CAT001',
            },
          },
        },
      ];

      prisma.inventory.findMany.mockResolvedValue(mockInventory);

      const result = await inventoryService.getAll({});

      expect(result).toHaveLength(1);
      expect(result[0].availableQuantity).toBe(80); // 100 - 20
      expect(prisma.inventory.findMany).toHaveBeenCalledTimes(1);
    });

    it('should filter by warehouse', async () => {
      const mockInventory = [];
      prisma.inventory.findMany.mockResolvedValue(mockInventory);

      await inventoryService.getAll({ warehouseId: 1 });

      expect(prisma.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            warehouseId: 1,
          }),
        })
      );
    });

    it('should filter by product', async () => {
      const mockInventory = [];
      prisma.inventory.findMany.mockResolvedValue(mockInventory);

      await inventoryService.getAll({ productId: 1 });

      expect(prisma.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productId: 1,
          }),
        })
      );
    });

    it('should filter low stock items', async () => {
      const mockInventory = [
        {
          id: 1,
          warehouseId: 1,
          productId: 1,
          quantity: 5,
          reservedQuantity: 0,
          warehouse: { id: 1, warehouseName: 'Test', warehouseCode: 'WH001', warehouseType: 'finished_product' },
          product: {
            id: 1,
            sku: 'PROD001',
            productName: 'Low Stock Product',
            productType: 'finished_product',
            unit: 'pcs',
            minStockLevel: 10,
            status: 'active',
            category: { id: 1, categoryName: 'Test', categoryCode: 'CAT001' },
          },
        },
      ];

      prisma.inventory.findMany.mockResolvedValue(mockInventory);

      const result = await inventoryService.getAll({ lowStock: true });

      expect(result).toHaveLength(1);
      expect(result[0].availableQuantity).toBeLessThan(result[0].product.minStockLevel);
    });
  });

  describe('checkAvailability', () => {
    it('should return true when enough stock available', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ id: 1, warehouseName: 'Test' });
      prisma.inventory.findFirst.mockResolvedValue({
        quantity: 100,
        reservedQuantity: 20,
      });

      const result = await inventoryService.checkAvailability(1, [
        { productId: 1, quantity: 50 },
      ]);

      expect(result.available).toBe(true);
      expect(result.items[0].available).toBe(true);
      expect(result.items[0].currentStock).toBe(80); // 100 - 20
    });

    it('should return false when insufficient stock', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ id: 1, warehouseName: 'Test' });
      prisma.inventory.findFirst.mockResolvedValue({
        quantity: 100,
        reservedQuantity: 20,
      });

      const result = await inventoryService.checkAvailability(1, [
        { productId: 1, quantity: 100 }, // More than available (80)
      ]);

      expect(result.available).toBe(false);
      expect(result.items[0].available).toBe(false);
      expect(result.items[0].shortage).toBe(20); // Need 100, have 80
    });

    it('should handle multiple products', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ id: 1, warehouseName: 'Test' });
      
      prisma.inventory.findFirst
        .mockResolvedValueOnce({ quantity: 100, reservedQuantity: 20 }) // Product 1: 80 available
        .mockResolvedValueOnce({ quantity: 50, reservedQuantity: 10 }); // Product 2: 40 available

      const result = await inventoryService.checkAvailability(1, [
        { productId: 1, quantity: 50 }, // OK
        { productId: 2, quantity: 30 }, // OK
      ]);

      expect(result.available).toBe(true);
      expect(result.items[0].available).toBe(true);
      expect(result.items[1].available).toBe(true);
    });

    it('should return false if any product is unavailable', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ id: 1, warehouseName: 'Test' });
      
      prisma.inventory.findFirst
        .mockResolvedValueOnce({ quantity: 100, reservedQuantity: 20 }) // Product 1: 80 available
        .mockResolvedValueOnce({ quantity: 20, reservedQuantity: 10 }); // Product 2: 10 available

      const result = await inventoryService.checkAvailability(1, [
        { productId: 1, quantity: 50 }, // OK
        { productId: 2, quantity: 30 }, // NOT OK - need 30, have 10
      ]);

      expect(result.available).toBe(false);
      expect(result.items[0].available).toBe(true);
      expect(result.items[1].available).toBe(false);
      expect(result.items[1].shortage).toBe(20);
    });
  });

  describe('updateQuantity', () => {
    it('should increase quantity correctly', async () => {
      const currentInventory = {
        id: 1,
        quantity: 100,
        reservedQuantity: 20,
      };

      prisma.inventory.findFirst.mockResolvedValue(currentInventory);
      prisma.inventory.update.mockResolvedValue({
        ...currentInventory,
        quantity: 150,
      });

      const result = await inventoryService.updateQuantity(1, 1, 50, 'increase');

      expect(result.quantity).toBe(150);
      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { quantity: 150 },
      });
    });

    it('should decrease quantity correctly', async () => {
      const currentInventory = {
        id: 1,
        quantity: 100,
        reservedQuantity: 20,
      };

      prisma.inventory.findFirst.mockResolvedValue(currentInventory);
      prisma.inventory.update.mockResolvedValue({
        ...currentInventory,
        quantity: 50,
      });

      const result = await inventoryService.updateQuantity(1, 1, 50, 'decrease');

      expect(result.quantity).toBe(50);
      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { quantity: 50 },
      });
    });

    it('should throw error when decreasing below zero', async () => {
      const currentInventory = {
        id: 1,
        quantity: 30,
        reservedQuantity: 20,
      };

      prisma.inventory.findFirst.mockResolvedValue(currentInventory);

      await expect(
        inventoryService.updateQuantity(1, 1, 50, 'decrease')
      ).rejects.toThrow('Insufficient inventory');
    });
  });

  describe('reserveQuantity', () => {
    it('should reserve quantity correctly', async () => {
      const currentInventory = {
        id: 1,
        quantity: 100,
        reservedQuantity: 20,
      };

      prisma.inventory.findFirst.mockResolvedValue(currentInventory);
      prisma.inventory.update.mockResolvedValue({
        ...currentInventory,
        reservedQuantity: 40,
      });

      const result = await inventoryService.reserveQuantity(1, 1, 20);

      expect(result.reservedQuantity).toBe(40);
      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { reservedQuantity: 40 },
      });
    });

    it('should throw error when reserving more than available', async () => {
      const currentInventory = {
        id: 1,
        quantity: 100,
        reservedQuantity: 20,
      };

      prisma.inventory.findFirst.mockResolvedValue(currentInventory);

      await expect(
        inventoryService.reserveQuantity(1, 1, 100) // Try to reserve 100, but only 80 available
      ).rejects.toThrow('Insufficient inventory to reserve');
    });
  });

  describe('releaseReservation', () => {
    it('should release reserved quantity correctly', async () => {
      const currentInventory = {
        id: 1,
        quantity: 100,
        reservedQuantity: 40,
      };

      prisma.inventory.findFirst.mockResolvedValue(currentInventory);
      prisma.inventory.update.mockResolvedValue({
        ...currentInventory,
        reservedQuantity: 20,
      });

      const result = await inventoryService.releaseReservation(1, 1, 20);

      expect(result.reservedQuantity).toBe(20);
      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { reservedQuantity: 20 },
      });
    });

    it('should not release more than reserved', async () => {
      const currentInventory = {
        id: 1,
        quantity: 100,
        reservedQuantity: 20,
      };

      prisma.inventory.findFirst.mockResolvedValue(currentInventory);
      prisma.inventory.update.mockResolvedValue({
        ...currentInventory,
        reservedQuantity: 0,
      });

      const result = await inventoryService.releaseReservation(1, 1, 50);

      expect(result.reservedQuantity).toBe(0);
    });
  });
});
