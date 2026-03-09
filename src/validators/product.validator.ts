import { z } from 'zod';

export const createProductSchema = z.object({
  code: z.string().trim().optional(),
  productName: z
    .string()
    .min(1, 'Tên sản phẩm là bắt buộc')
    .max(200, 'Tên sản phẩm quá dài')
    .trim(),
  categoryId: z.number().or(z.string().transform(Number)).optional(),
  supplierId: z.number().or(z.string().transform(Number)).optional(),
  unitId: z.number().or(z.string().transform(Number)).optional(),
  description: z.string().max(500, 'Mô tả quá dài').optional(),
  basePrice: z.number().min(0, 'Giá mua không thể âm').optional(),
  price: z.number().min(0, 'Giá bán lẻ không thể âm').optional(),
  minStockLevel: z.number().min(0, 'Tồn kho tối thiểu không thể âm').optional().default(0),
  status: z.enum(['active', 'inactive', 'discontinued']).optional().default('active'),
  // New fields added
  taxIds: z.array(z.number()).optional(),
  attributeIdsWithValue: z.array(z.object({
    attributeId: z.number().or(z.string().transform(Number)),
    value: z.string().optional()
  })).optional(),
  unitConversions: z.array(z.object({
    unitId: z.number().or(z.string().transform(Number)),
    conversionFactor: z.number().or(z.string().transform(Number))
  })).optional(),
  applyWarranty: z.boolean().optional(),
  warrantyPolicy: z.any().optional(),
});

export const updateProductSchema = z.object({
  code: z.string().trim().optional(),
  productName: z.string().min(1, 'Tên sản phẩm không thể trống').max(200).trim().optional(),
  categoryId: z.number().or(z.string().transform(Number)).nullable().optional(),
  supplierId: z.number().or(z.string().transform(Number)).nullable().optional(),
  unitId: z.number().or(z.string().transform(Number)).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  basePrice: z.number().min(0, 'Giá mua không thể âm').nullable().optional(),
  price: z.number().min(0, 'Giá bán lẻ không thể âm').nullable().optional(),
  minStockLevel: z.number().min(0).optional(),
  status: z.enum(['active', 'inactive', 'discontinued']).optional(),
  // New fields added
  taxIds: z.array(z.number()).optional(),
  attributeIdsWithValue: z.array(z.object({
    attributeId: z.number().or(z.string().transform(Number)),
    value: z.string().optional()
  })).optional(),
  unitConversions: z.array(z.object({
    unitId: z.number().or(z.string().transform(Number)),
    conversionFactor: z.number().or(z.string().transform(Number))
  })).optional(),
  applyWarranty: z.boolean().optional(),
  warrantyPolicy: z.any().optional(),
});

export const updateFeaturedSchema = z
  .object({
    action: z.enum(['set_featured', 'unset_featured', 'reset_all']),
    productIds: z.array(z.number().int().positive()).optional(),
  })
  .refine(
    (data) => {
      if (['set_featured', 'unset_featured'].includes(data.action)) {
        return data.productIds && data.productIds.length > 0;
      }
      return true;
    },
    {
      message: 'productIds is required for set/unset actions',
      path: ['productIds'],
    }
  );

export const productQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
  search: z.string().optional(),
  categoryId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  warehouseId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  supplierId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  status: z
    .enum(['active', 'inactive', 'discontinued'])
    .refine((val) => !!val, { message: 'Trạng thái không hợp lệ!' })
    .optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z
    .enum(['asc', 'desc'])
    .refine((val) => !!val, { message: 'Sắp xếp không hợp lệ!' })
    .optional()
    .default('desc'),
});

export const productIdSchema = z.object({
  id: z.string().transform(Number),
});

export const uploadProductImagesSchema = z.object({
  images: z
    .array(
      z.object({
        imageType: z
          .enum(['thumbnail', 'gallery', 'main'])
          .refine((val) => !!val, { message: 'Loại hình ảnh không hợp lệ' })
          .optional()
          .default('gallery'),
        altText: z.string().max(255).optional(),
        isPrimary: z.boolean().optional().default(false),
        displayOrder: z.number().int().min(0).optional().default(0),
      })
    )
    .min(1, 'Phải có ít nhất một hình ảnh')
    .max(5, 'Tối đa 5 hình ảnh'),
});

export const uploadProductVideosSchema = z.object({
  videos: z
    .array(
      z.object({
        videoType: z
          .enum(['demo', 'tutorial', 'review', 'unboxing', 'promotion', 'other'])
          .refine((val) => !!val, { message: 'Loại video không hợp lệ' })
          .optional()
          .default('demo'),
        title: z.string().max(255).optional(),
        description: z.string().max(500).optional(),
        isPrimary: z.boolean().optional().default(false),
        displayOrder: z.number().int().min(0).optional().default(0),
      })
    )
    .min(1, 'Phải có ít nhất một video')
    .max(5, 'Tối đa 5 video'),
});

export const deleteImageSchema = z.object({
  imageId: z.string().transform(Number),
});

export const deleteVideoSchema = z.object({
  videoId: z.string().transform(Number),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateFeaturedInput = z.infer<typeof updateFeaturedSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type ProductIdInput = z.infer<typeof productIdSchema>;
export type UploadProductImagesInput = z.infer<typeof uploadProductImagesSchema>;
export type UploadProductVideosInput = z.infer<typeof uploadProductVideosSchema>;
export type DeleteImageInput = z.infer<typeof deleteImageSchema>;
export type DeleteVideoInput = z.infer<typeof deleteVideoSchema>;
