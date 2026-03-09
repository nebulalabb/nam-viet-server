import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import uploadService from './upload.service';
import {
  ProductQueryInput,
  CreateProductInput,
  UpdateProductInput,
} from '@validators/product.validator';
import path from 'path';
import { serializeBigInt } from '@utils/serializer';

const prisma = new PrismaClient();

class ProductService {
  private async generateCode(): Promise<string> {
    const count = await prisma.product.count();
    const number = (count + 1).toString().padStart(4, '0');
    return `PRD-${number}`;
  }

  async getAll(params: ProductQueryInput) {
    const {
      page = 1,
      limit = 20,
      search,
      categoryId,
      supplierId,
      warehouseId,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;


    const offset = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [
          { productName: { contains: search } },
          { code: { contains: search } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(supplierId && { supplierId }),
      ...(warehouseId && {
        inventory: {
          some: {
            warehouseId,
          },
        },
      }),
      ...(status && { status: status as any }),
    };

    const total = await prisma.product.count({ where });

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            categoryName: true,
            categoryCode: true,
          },
        },
        supplier: {
          select: {
            id: true,
            supplierName: true,
            supplierCode: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitCode: true,
            unitName: true,
          },
        },
        images: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            imageUrl: true,
            imageType: true,
            altText: true,
            isPrimary: true,
            displayOrder: true,
          },
        },
        inventory: {
          select: {
            quantity: true,
            reservedQuantity: true,
            warehouseId: true,
            warehouse: {
              select: {
                id: true,
                warehouseName: true,
              }
            }
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        _count: {
          select: {
            inventory: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit,
    });

    const result = {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return result;
  }

  async getById(id: number) {

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            categoryName: true,
            categoryCode: true,
          },
        },
        supplier: {
          select: {
            id: true,
            supplierName: true,
            supplierCode: true,
            phone: true,
            email: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitCode: true,
            unitName: true,
          },
        },
        images: {
          orderBy: { displayOrder: 'asc' },
        },
        videos: {
          orderBy: { displayOrder: 'asc' },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        updater: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        inventory: {
          include: {
            warehouse: {
              select: {
                id: true,
                warehouseName: true,
                warehouseCode: true,
                warehouseType: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    // Serialize BigInt in videos before caching/returning
    const serializedProduct = {
      ...product,
      videos: product.videos?.map((video) => serializeBigInt(video)),
    };

    return serializedProduct;
  }

  async create(data: CreateProductInput, userId: number) {
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) {
        throw new NotFoundError('Category');
      }
    }

    if (data.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
      });
      if (!supplier) {
        throw new NotFoundError('Supplier');
      }
    }

    const code = data.code || (await this.generateCode());

    const existingCode = await prisma.product.findUnique({
      where: { code },
    });
    if (existingCode) {
      throw new ConflictError('Mã sản phẩm đã tồn tại', { code });
    }

    const product = await prisma.product.create({
      data: {
        code,
        productName: data.productName,
        categoryId: data.categoryId,
        supplierId: data.supplierId,
        unitId: data.unitId,
        description: data.description,
        basePrice: data.basePrice,
        price: data.price,
        taxIds: data.taxIds ? JSON.parse(JSON.stringify(data.taxIds)) : null,
        applyWarranty: data.applyWarranty || false,
        warrantyPolicy: data.warrantyPolicy ? JSON.parse(JSON.stringify(data.warrantyPolicy)) : null,
        minStockLevel: data.minStockLevel,
        status: (data.status as any) || 'active',
        createdBy: userId,
        productHasAttributes: {
          create: data.attributeIdsWithValue?.map((attr) => ({
            attributeId: attr.attributeId,
            value: attr.value,
          })) || [],
        },
        unitConversions: {
          create: data.unitConversions?.map((uc) => ({
            unitId: uc.unitId,
            conversionFactor: uc.conversionFactor,
          })) || [],
        },
      },
      include: {
        category: true,
        supplier: true,
        images: true,
      },
    });

    logActivity('create', userId, 'products', {
      recordId: product.id,
      newValue: product,
    });

    return product;
  }

  async update(id: number, data: UpdateProductInput, userId: number) {
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundError('Product');
    }

    if (data.categoryId !== undefined && data.categoryId !== null) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId as number },
      });
      if (!category) {
        throw new NotFoundError('Category');
      }
    }

    if (data.supplierId !== undefined && data.supplierId !== null) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId as number },
      });
      if (!supplier) {
        throw new NotFoundError('Supplier');
      }
    }

    if (data.code && data.code !== existingProduct.code) {
      const existingCode = await prisma.product.findUnique({
        where: { code: data.code as string },
      });
      if (existingCode) {
        throw new ConflictError('Mã sản phẩm đã tồn tại', { code: data.code });
      }
    }

    const {
      attributeIdsWithValue,
      unitConversions,
      taxIds,
      warrantyPolicy,
      ...restData
    } = data;

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...restData,
        taxIds: taxIds !== undefined ? taxIds ? JSON.parse(JSON.stringify(taxIds)) : null : undefined,
        warrantyPolicy: warrantyPolicy !== undefined ? warrantyPolicy ? JSON.parse(JSON.stringify(warrantyPolicy)) : null : undefined,
        updatedBy: userId,
        ...(attributeIdsWithValue && {
          productHasAttributes: {
            deleteMany: {},
            create: attributeIdsWithValue.map((attr) => ({
              attributeId: attr.attributeId,
              value: attr.value,
            })),
          },
        }),
        ...(unitConversions && {
          unitConversions: {
            deleteMany: {},
            create: unitConversions.map((uc) => ({
              unitId: uc.unitId,
              conversionFactor: uc.conversionFactor,
            })),
          },
        }),
      },
      include: {
        category: true,
        supplier: true,
        images: true,
      },
    });

    logActivity('update', userId, 'products', {
      recordId: id,
      oldValue: existingProduct,
      newValue: product,
    });

    return product;
  }

  /**
   * Cập nhật trạng thái Banner (IsFeatured) cho nhiều sản phẩm
   * Đã được xoá cột `isFeatured` khỏi Database ở phiên bản này, 
   * logic giữ tạm để không lỗi Route hoặc có thể xóa luôn.
   */
  async updateBannerStatus(
    action: 'set_featured' | 'unset_featured' | 'reset_all',
    _userId: number,
    _productIds: number[] = []
  ) {
    return {
      success: true,
      action,
      updatedCount: 0,
      affectedIds: [],
    };
  }


  async delete(id: number, userId: number) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        videos: true,
        inventory: true,
        purchaseOrderDetails: true,
        invoiceDetails: true,
      },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    if (product.inventory.length > 0) {
      const totalStock = product.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
      if (totalStock > 0) {
        throw new ValidationError(
          'Cannot delete product with existing inventory. Please clear inventory first.'
        );
      }
    }

    if (product.purchaseOrderDetails.length > 0 || product.invoiceDetails.length > 0) {
      throw new ValidationError(
        'Cannot delete product that has been used in orders. Consider marking it as discontinued instead.'
      );
    }

    // // Delete all image files
    // for (const image of product.images) {
    //   await uploadService.deleteFile(image.imageUrl);
    // }

    // // Delete all video files
    // for (const video of product.videos) {
    //   await uploadService.deleteFile(video.videoUrl);
    // }

    // soft delete
    await prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    logActivity('delete', userId, 'products', {
      recordId: id,
      oldValue: product,
    });

    return { message: 'Product deleted successfully' };
  }

  async getLowStock(warehouseId?: number) {
    const products = await prisma.product.findMany({
      where: {
        status: 'active',
        minStockLevel: { gt: 0 },
      },
      include: {
        category: true,
        inventory: warehouseId
          ? {
            where: { warehouseId },
            include: { warehouse: true },
          }
          : {
            include: { warehouse: true },
          },
      },
    });

    const lowStockProducts = products
      .map((product) => {
        const totalStock = product.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
        const availableStock = product.inventory.reduce(
          (sum, inv) => sum + Number(inv.quantity) - Number(inv.reservedQuantity),
          0
        );

        return {
          ...product,
          totalStock,
          availableStock,
          shortfall: Number(product.minStockLevel) - availableStock,
        };
      })
      .filter((p) => p.availableStock < Number(p.minStockLevel));

    return lowStockProducts;
  }

  async getExpiringSoon(_days: number = 7) {
    // Note: Expiry dates are now tracked at the InventoryBatch level, not the Product level.
    // For a fully accurate report, this should query InventoryBatches and join with Products.
    // Returning empty array for now as per updated tracking logic.
    return [];
  }

  async uploadImages(
    productId: number,
    files: Express.Multer.File[],
    imageMetadata: Array<{
      imageType?: string;
      altText?: string;
      isPrimary?: boolean;
      displayOrder?: number;
    }>,
    userId: number
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    if (product.images.length + files.length > 5) {
      throw new ValidationError('Maximum 5 images allowed per product');
    }

    const uploadedImages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const metadata = imageMetadata[i] || {};

      const processedPath = await this.processProductImage(file, productId);

      const image = await prisma.productImage.create({
        data: {
          productId,
          imageUrl: processedPath,
          imageType: (metadata.imageType as any) || 'gallery',
          altText: metadata.altText,
          isPrimary: metadata.isPrimary || false,
          displayOrder: metadata.displayOrder || i,
          uploadedBy: userId,
        },
      });

      uploadedImages.push(image);
    }

    logActivity('update', userId, 'products', {
      recordId: productId,
      action: 'upload_images',
      newValue: uploadedImages,
    });

    return uploadedImages;
  }

  private async processProductImage(file: Express.Multer.File, productId: number): Promise<string> {
    const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'products');
    const sharp = require('sharp');
    const fs = require('fs/promises');

    await fs.mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `product-${productId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const outputPath = path.join(uploadDir, filename);

    await sharp(file.path)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    await uploadService.deleteFile(file.path);

    return `/uploads/products/${filename}`;
  }

  private async processProductVideo(file: Express.Multer.File, productId: number): Promise<string> {
    const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'products');
    const fs = require('fs/promises');

    await fs.mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `video-${productId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const outputPath = path.join(uploadDir, filename);

    // Move file from temp location (AVATAR_DIR) to products directory
    await fs.rename(file.path, outputPath);

    return `/uploads/products/${filename}`;
  }

  async deleteImage(productId: number, imageId: number, userId: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    const image = await prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundError('Image');
    }

    await uploadService.deleteFile(image.imageUrl);

    await prisma.productImage.delete({
      where: { id: imageId },
    });

    logActivity('update', userId, 'products', {
      recordId: productId,
      action: 'delete_image',
      oldValue: image,
    });

    return { message: 'Image deleted successfully' };
  }

  /**
   * Set primary image for product
   */
  async setPrimaryImage(productId: number, imageId: number, userId: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    const image = await prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundError('Image');
    }

    // Reset all images to non-primary
    await prisma.productImage.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });

    // Set the selected image as primary
    const updatedImage = await prisma.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    });

    logActivity('update', userId, 'products', {
      recordId: productId,
      action: 'set_primary_image',
      newValue: { imageId },
    });

    return updatedImage;
  }

  // ===== VIDEO METHODS =====

  async uploadVideos(
    productId: number,
    files: Express.Multer.File[],
    videoMetadata: Array<{
      videoType?: string;
      title?: string;
      description?: string;
      isPrimary?: boolean;
      displayOrder?: number;
    }>,
    userId: number
  ) {
    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { videos: true },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    // Validate files
    if (!files || files.length === 0) {
      throw new ValidationError('At least one video file is required');
    }

    if (files.length > 5) {
      throw new ValidationError('Maximum 5 videos allowed per request');
    }

    // Validate total videos won't exceed limit
    if (product.videos.length + files.length > 5) {
      throw new ValidationError('Maximum 5 videos allowed per product');
    }

    // Validate each file
    const validVideoMimes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/webm',
    ];
    const maxFileSize = 500 * 1024 * 1024; // 500MB

    for (const file of files) {
      if (!validVideoMimes.includes(file.mimetype)) {
        throw new ValidationError(
          `Invalid video format: ${file.mimetype}. Supported: MP4, MOV, AVI, MKV, WebM`
        );
      }

      if (file.size > maxFileSize) {
        throw new ValidationError(
          `Video file too large. Maximum size: 500MB, Got: ${(file.size / 1024 / 1024).toFixed(
            2
          )}MB`
        );
      }
    }

    // Validate metadata
    for (let i = 0; i < videoMetadata.length; i++) {
      const meta = videoMetadata[i];

      if (
        meta.videoType &&
        !['demo', 'tutorial', 'review', 'unboxing', 'promotion', 'other'].includes(meta.videoType)
      ) {
        throw new ValidationError(`Invalid video type: ${meta.videoType}`);
      }

      if (meta.title && meta.title.length > 255) {
        throw new ValidationError(`Video title too long (max 255 characters)`);
      }

      if (meta.description && meta.description.length > 500) {
        throw new ValidationError(`Video description too long (max 500 characters)`);
      }

      if (meta.displayOrder !== undefined && meta.displayOrder < 0) {
        throw new ValidationError(`Display order cannot be negative`);
      }
    }

    const uploadedVideos = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const metadata = videoMetadata[i] || {};

      // Process video: move to products directory and rename
      const videoPath = await this.processProductVideo(file, productId);

      const video = await prisma.productVideo.create({
        data: {
          productId,
          videoUrl: videoPath,
          videoType: (metadata.videoType as any) || 'demo',
          title: metadata.title,
          description: metadata.description,
          isPrimary: metadata.isPrimary || false,
          displayOrder: metadata.displayOrder || i,
          uploadedBy: userId,
          fileSize: BigInt(file.size),
          // TODO: Extract duration and generate thumbnail using ffmpeg
          duration: null,
          thumbnail: null,
        },
      });

      uploadedVideos.push(video);
    }

    // Convert BigInt to String for JSON serialization
    const serializedVideos = serializeBigInt(uploadedVideos);

    logActivity('create', userId, 'product_videos', {
      recordId: productId,
      action: 'upload_videos',
      newValue: serializedVideos,
    });

    return serializedVideos;
  }

  async deleteVideo(productId: number, videoId: number, userId: number) {
    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    // Validate video exists and belongs to product
    const video = await prisma.productVideo.findFirst({
      where: {
        id: videoId,
        productId,
      },
    });

    if (!video) {
      throw new NotFoundError('Video not found for this product');
    }

    // Delete video file from storage
    await uploadService.deleteFile(video.videoUrl);

    // Delete from database
    await prisma.productVideo.delete({
      where: { id: videoId },
    });

    logActivity('delete', userId, 'product_videos', {
      recordId: productId,
      action: 'delete_video',
      oldValue: video,
    });

    return { message: 'Video deleted successfully' };
  }

  async setPrimaryVideo(productId: number, videoId: number, userId: number) {
    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    // Validate video exists and belongs to product
    const video = await prisma.productVideo.findFirst({
      where: {
        id: videoId,
        productId,
      },
    });

    if (!video) {
      throw new NotFoundError('Video not found for this product');
    }

    // Validate video is not already primary
    if (video.isPrimary) {
      throw new ValidationError('This video is already set as primary');
    }

    // Reset all videos to non-primary
    await prisma.productVideo.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });

    // Set the selected video as primary
    const updatedVideo = await prisma.productVideo.update({
      where: { id: videoId },
      data: { isPrimary: true },
    });

    logActivity('update', userId, 'products', {
      recordId: productId,
      action: 'set_primary_video',
      newValue: { videoId },
    });

    // Convert BigInt to String for JSON serialization
    return serializeBigInt(updatedVideo);
  }

  async getStats() {

    // Get all products with counts
    const products = await prisma.product.findMany({
      select: {
        id: true,
        productName: true,
        status: true,
        supplierId: true,
        categoryId: true,
      },
    });

    // Calculate statistics
    const totalProducts = products.length;
    const activeCount = products.filter((p) => p.status === 'active').length;
    const inactiveCount = products.filter((p) => p.status === 'inactive').length;
    const discontinuedCount = products.filter((p) => p.status === 'discontinued').length;

    const withoutSupplier = products.filter((p) => !p.supplierId).length;
    const withoutCategory = products.filter((p) => !p.categoryId).length;

    const stats = {
      totalProducts,
      byStatus: {
        active: activeCount,
        inactive: inactiveCount,
        discontinued: discontinuedCount,
      },
      byType: {
        rawMaterial: 0,
        packaging: 0,
        finished: 0,
        goods: totalProducts,
      },
      dataQuality: {
        withoutSupplier,
        withoutCategory,
      },
    };

    return stats;
  }

  async getRawMaterialStats() {
    return {
      totalRawMaterials: 0,
      byStatus: { active: 0, inactive: 0, discontinued: 0 },
      lowStockCount: 0,
      expiringCount: 0,
      discontinuedCount: 0,
      totalInventoryValue: 0,
    };
  }

  async getPackagingStats() {
    return {
      totalPackaging: 0,
      byStatus: { active: 0, inactive: 0, discontinued: 0 },
      lowStockCount: 0,
      expiringCount: 0,
      discontinuedCount: 0,
      totalInventoryValue: 0,
    };
  }

  async getGoodsStats() {
    const goods = await prisma.product.findMany({
      include: {
        inventory: true,
      },
    });

    const totalGoods = goods.length;
    const activeCount = goods.filter((p) => p.status === 'active').length;
    const inactiveCount = goods.filter((p) => p.status === 'inactive').length;
    const discontinuedCount = goods.filter((p) => p.status === 'discontinued').length;

    let lowStockCount = 0;
    for (const good of goods) {
      const totalInventory = good.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
      if (totalInventory < Number(good.minStockLevel)) {
        lowStockCount++;
      }
    }

    let totalInventoryValue = 0;
    for (const good of goods) {
      const totalQuantity = good.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
      const basePrice = Number(good.basePrice) || 0;
      totalInventoryValue += totalQuantity * basePrice;
    }

    const stats = {
      totalPackaging: totalGoods,
      byStatus: {
        active: activeCount,
        inactive: inactiveCount,
        discontinued: discontinuedCount,
      },
      lowStockCount,
      expiringCount: 0,
      discontinuedCount,
      totalInventoryValue,
    };

    return stats;
  }
}

export default new ProductService();
