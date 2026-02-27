import { Response, NextFunction } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import { AuthorizationError } from '@utils/errors';
import { asyncHandler } from './errorHandler';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const getUserPermissions = async (roleId: number): Promise<string[]> => {
  const rolePermissions = await prisma.role.findMany({
    where: { id: roleId },
    include: {
      rolePermissions: {
        include: {
          permission: {
            select: {
              permissionKey: true,
            },
          },
        },
      },
    },
  });

  const permissions = rolePermissions.flatMap((role) =>
    role.rolePermissions.map((rolePermission) => rolePermission.permission.permissionKey)
  );

  return permissions;
};

export const authorize = (...requiredPermissions: string[]) => {
  return asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthorizationError('Authentication required');
    }

    const userPermissions = await getUserPermissions(req.user.roleId);

    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      throw new AuthorizationError(
        `Missing required permissions: ${requiredPermissions.join(', ')}`
      );
    }

    next();
  });
};

export const authorizeAny = (...permissions: string[]) => {
  return asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthorizationError('Authentication required');
    }

    const userPermissions = await getUserPermissions(req.user.roleId);

    const hasAnyPermission = permissions.some((permission) => userPermissions.includes(permission));

    if (!hasAnyPermission) {
      throw new AuthorizationError(
        `Missing one of required permissions: ${permissions.join(', ')}`
      );
    }

    next();
  });
};

export const requireRole = (...roles: string[]) => {
  return asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthorizationError('Authentication required');
    }

    const role = await prisma.role.findUnique({
      where: { id: req.user.roleId },
      select: { roleKey: true },
    });

    if (!role || !roles.includes(role.roleKey)) {
      throw new AuthorizationError(`Required role: ${roles.join(' or ')}`);
    }

    next();
  });
};

export const checkWarehouseAccess = (warehouseIdParam: string = 'warehouseId') => {
  return asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthorizationError('Authentication required');
    }

    const role = await prisma.role.findUnique({
      where: { id: req.user.roleId },
      select: { roleKey: true },
    });

    if (role?.roleKey === 'admin' || role?.roleKey === 'warehouse_manager') {
      return next();
    }

    const requestedWarehouseId = parseInt(req.params[warehouseIdParam] || req.body.warehouse_id);

    if (!requestedWarehouseId) {
      throw new AuthorizationError('Warehouse ID is required');
    }

    if (req.user.warehouseId && req.user.warehouseId !== requestedWarehouseId) {
      throw new AuthorizationError('Access denied to this warehouse');
    }

    next();
  });
};

