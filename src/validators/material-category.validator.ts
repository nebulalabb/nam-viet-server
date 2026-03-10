import { z } from 'zod';

export const createMaterialCategorySchema = z.object({
  categoryCode: z
    .string()
    .min(1, 'Category code is required')
    .max(50, 'Category code too long')
    .regex(/^[A-Z0-9-]+$/, 'Category code must be uppercase alphanumeric with hyphens')
    .trim(),
  categoryName: z
    .string()
    .min(1, 'Category name is required')
    .max(200, 'Category name too long')
    .trim(),
  parentId: z.number().int().positive('Invalid parent category ID').nullable().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateMaterialCategorySchema = z.object({
  categoryCode: z
    .string()
    .max(50, 'Category code too long')
    .regex(/^[A-Z0-9-]+$/, 'Category code must be uppercase alphanumeric with hyphens')
    .trim()
    .optional(),
  categoryName: z.string().max(200, 'Category name too long').trim().optional(),
  parentId: z.number().int().positive('Invalid parent category ID').nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const queryMaterialCategoriesSchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  search: z.string().trim().optional(),
  // parentId can be:
  // - a number string (e.g., "123") - filter by parent ID
  // - "null" string - filter root categories (where parentId is null)
  // - undefined - no filter (get all)
  parentId: z
    .string()
    .refine((val) => val === 'null' || /^\d+$/.test(val), {
      message: 'parentId must be a number or "null"',
    })
    .optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'categoryName', 'categoryCode'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const updateMaterialCategoryStatusSchema = z.object({
  status: z.enum(['active', 'inactive'], { message: 'Trạng thái không hợp lệ' }),
});

export const bulkDeleteMaterialCategorySchema = z.object({
  ids: z.array(z.number().int().positive(), { message: 'Danh sách ID không hợp lệ' }).min(1, 'Vui lòng chọn ít nhất một danh mục'),
});

export type CreateMaterialCategoryInput = z.infer<typeof createMaterialCategorySchema>;
export type UpdateMaterialCategoryInput = z.infer<typeof updateMaterialCategorySchema>;
export type QueryMaterialCategoriesInput = z.infer<typeof queryMaterialCategoriesSchema>;
export type UpdateMaterialCategoryStatusInput = z.infer<typeof updateMaterialCategoryStatusSchema>;
export type BulkDeleteMaterialCategoryInput = z.infer<typeof bulkDeleteMaterialCategorySchema>;
