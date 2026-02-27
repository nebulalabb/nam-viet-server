import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  QueryCategoriesInput,
} from '@validators/category.validator';

const prisma = new PrismaClient();

class CategoryService {
  async getAllCategories(query: QueryCategoriesInput) {
    const {
      page = '1',
      limit = '20',
      search,
      parentId,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.CategoryWhereInput = {
      ...(search && {
        OR: [
          { categoryName: { contains: search } },
          { categoryCode: { contains: search } },
          { description: { contains: search } },
        ],
      }),
      // Handle parentId filter:
      // - If parentId is provided and is 'null' string → filter root categories (parentId: null)
      // - If parentId is a number string → filter by that parent
      // - If parentId is undefined → no filter (show all)
      ...(parentId !== undefined && {
        parentId: parentId === 'null' ? null : parseInt(parentId),
      }),
      ...(status && { status }),
    };

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          categoryCode: true,
          categoryName: true,
          slug: true,
          parentId: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          parent: {
            select: {
              id: true,
              categoryCode: true,
              categoryName: true,
            },
          },
          _count: {
            select: {
              children: true,
              products: true,
            },
          },
        },
      }),
      prisma.category.count({ where }),
    ]);

    const result = {
      data: categories,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      message: 'Lấy danh sách danh mục thành công',
    };

    return result;

    return result;
  }

  async getCategoryTree() {

    const categories = await prisma.category.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        categoryCode: true,
        categoryName: true,
        slug: true,
        parentId: true,
        description: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: { categoryName: 'asc' },
    });

    const tree = this.buildTree(categories, null);

    return tree;

    return tree;
  }

  private buildTree(categories: any[], parentId: number | null): any[] {
    return categories
      .filter((cat) => cat.parentId === parentId)
      .map((cat) => ({
        ...cat,
        children: this.buildTree(categories, cat.id),
      }));
  }

  async getCategoryById(id: number) {

    const category = await prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        categoryCode: true,
        categoryName: true,
        slug: true,
        parentId: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        parent: {
          select: {
            id: true,
            categoryCode: true,
            categoryName: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            categoryCode: true,
            categoryName: true,
            slug: true,
            status: true,
            _count: {
              select: {
                products: true,
              },
            },
          },
        },
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundError('Danh mục không tồn tại');
    }

    return category;

    return category;
  }

  async createCategory(data: CreateCategoryInput, createdBy: number) {
    const codeExists = await this.checkCategoryCodeExists(data.categoryCode);
    if (codeExists) {
      throw new ConflictError('Mã danh mục đã tồn tại');
    }

    const slugExists = await this.checkSlugExists(data.slug);
    if (slugExists) {
      throw new ConflictError('Slug đã tồn tại');
    }

    if (data.parentId) {
      const parentExists = await prisma.category.findUnique({
        where: { id: data.parentId },
      });
      if (!parentExists) {
        throw new NotFoundError('Danh mục cha không tồn tại');
      }
    }

    const category = await prisma.category.create({
      data: {
        categoryCode: data.categoryCode,
        categoryName: data.categoryName,
        slug: data.slug,
        parentId: data.parentId || null,
        description: data.description || null,
        status: data.status || 'active',
      },
      select: {
        id: true,
        categoryCode: true,
        categoryName: true,
        slug: true,
        parentId: true,
        description: true,
        status: true,
        createdAt: true,
        parent: {
          select: {
            id: true,
            categoryCode: true,
            categoryName: true,
          },
        },
      },
    });

    logActivity('create', createdBy, 'categories', {
      recordId: category.id,
      newValue: category,
    });

    return category;

    return category;
  }

  async updateCategory(id: number, data: UpdateCategoryInput, updatedBy: number) {
    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      throw new NotFoundError('Danh mục không tồn tại');
    }

    if (data.categoryCode && data.categoryCode !== existingCategory.categoryCode) {
      const codeExists = await this.checkCategoryCodeExists(data.categoryCode, id);
      if (codeExists) {
        throw new ConflictError('Mã danh mục đã tồn tại');
      }
    }

    if (data.slug && data.slug !== existingCategory.slug) {
      const slugExists = await this.checkSlugExists(data.slug, id);
      if (slugExists) {
        throw new ConflictError('Slug đã tồn tại');
      }
    }

    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        throw new ValidationError('Danh mục không thể là danh mục cha của chính nó');
      }

      if (data.parentId !== null) {
        const parentExists = await prisma.category.findUnique({
          where: { id: data.parentId },
        });
        if (!parentExists) {
          throw new NotFoundError('Danh mục cha không tồn tại');
        }

        const isCircular = await this.checkCircularReference(id, data.parentId);
        if (isCircular) {
          throw new ValidationError('Phát hiện tham chiếu vòng. Không thể đặt danh mục cha.');
        }
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        ...(data.categoryCode && { categoryCode: data.categoryCode }),
        ...(data.categoryName && { categoryName: data.categoryName }),
        ...(data.slug && { slug: data.slug }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status }),
      },
      select: {
        id: true,
        categoryCode: true,
        categoryName: true,
        slug: true,
        parentId: true,
        description: true,
        status: true,
        updatedAt: true,
        parent: {
          select: {
            id: true,
            categoryCode: true,
            categoryName: true,
          },
        },
      },
    });

    logActivity('update', updatedBy, 'categories', {
      recordId: id,
      oldValue: existingCategory,
      newValue: updatedCategory,
    });

    return updatedCategory;

    return updatedCategory;
  }

  async deleteCategory(id: number, deletedBy: number) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundError('Danh mục không tồn tại');
    }

    if (category._count.children > 0) {
      throw new ValidationError('Không thể xóa danh mục có danh mục con');
    }

    if (category._count.products > 0) {
      throw new ValidationError('Không thể xóa danh mục có sản phẩm');
    }

    // soft delete
    await prisma.category.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    logActivity('delete', deletedBy, 'categories', {
      recordId: id,
      oldValue: category,
    });

    return { message: 'Xóa danh mục thành công' };

    return { message: 'Xóa danh mục thành công' };
  }

  async checkCategoryCodeExists(code: string, excludeId?: number): Promise<boolean> {
    const category = await prisma.category.findFirst({
      where: {
        categoryCode: code,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    return !!category;
  }

  async checkSlugExists(slug: string, excludeId?: number): Promise<boolean> {
    const category = await prisma.category.findFirst({
      where: {
        slug,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    return !!category;
  }

  private async checkCircularReference(categoryId: number, newParentId: number): Promise<boolean> {
    let currentParentId: number | null = newParentId;

    while (currentParentId !== null) {
      if (currentParentId === categoryId) {
        return true;
      }

      const parent: { parentId: number | null } | null = await prisma.category.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });

      currentParentId = parent?.parentId || null;
    }

    return false;
  }



  async getCategoryStats() {

    // Get all categories with stats
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        categoryName: true,
        parentId: true,
        status: true,
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
    });

    // Calculate statistics
    const totalCategories = categories.length;
    const activeCategories = categories.filter((c) => c.status === 'active').length;
    const inactiveCategories = categories.filter((c) => c.status === 'inactive').length;
    const rootCategories = categories.filter((c) => !c.parentId).length;
    const totalProducts = categories.reduce((sum, c) => sum + c._count.products, 0);

    // Get top categories by product count
    const topCategories = categories
      .filter((c) => c._count.products > 0)
      .sort((a, b) => b._count.products - a._count.products)
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        categoryName: c.categoryName,
        productCount: c._count.products,
      }));

    const stats = {
      totalCategories,
      activeCategories,
      inactiveCategories,
      rootCategories,
      totalProducts,
      topCategories,
    };

    return stats;

    return stats;
  }
}

export default new CategoryService();
