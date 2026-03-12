import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const permissionsData = [
    // Quản lý nhân sự
    { key: "GET_USER", name: "Xem", module: "user", moduleLabel: "Nhân sự" },
    { key: "CREATE_USER", name: "Thêm", module: "user", moduleLabel: "Nhân sự" },
    { key: "UPDATE_USER", name: "Sửa", module: "user", moduleLabel: "Nhân sự" },
    { key: "DELETE_USER", name: "Xóa", module: "user", moduleLabel: "Nhân sự" },

    // Quản lý vai trò
    { key: "GET_ROLE", name: "Xem", module: "role", moduleLabel: "Vai trò" },
    { key: "CREATE_ROLE", name: "Thêm", module: "role", moduleLabel: "Vai trò" },
    { key: "UPDATE_ROLE", name: "Sửa", module: "role", moduleLabel: "Vai trò" },
    { key: "DELETE_ROLE", name: "Xóa", module: "role", moduleLabel: "Vai trò" },

    // Quản lý danh mục
    { key: "GET_CATEGORY", name: "Xem", module: "category", moduleLabel: "Danh mục" },
    { key: "CREATE_CATEGORY", name: "Thêm", module: "category", moduleLabel: "Danh mục" },
    { key: "UPDATE_CATEGORY", name: "Sửa", module: "category", moduleLabel: "Danh mục" },
    { key: "DELETE_CATEGORY", name: "Xóa", module: "category", moduleLabel: "Danh mục" },

    // Quản lý đơn vị
    { key: "GET_UNIT", name: "Xem", module: "unit", moduleLabel: "Đơn vị" },
    { key: "CREATE_UNIT", name: "Thêm", module: "unit", moduleLabel: "Đơn vị" },
    { key: "UPDATE_UNIT", name: "Sửa", module: "unit", moduleLabel: "Đơn vị" },
    { key: "DELETE_UNIT", name: "Xóa", module: "unit", moduleLabel: "Đơn vị" },

    // Quản lý thuộc tính
    { key: "GET_ATTRIBUTE", name: "Xem", module: "attribute", moduleLabel: "Thuộc tính" },
    { key: "CREATE_ATTRIBUTE", name: "Thêm", module: "attribute", moduleLabel: "Thuộc tính" },
    { key: "UPDATE_ATTRIBUTE", name: "Sửa", module: "attribute", moduleLabel: "Thuộc tính" },
    { key: "DELETE_ATTRIBUTE", name: "Xóa", module: "attribute", moduleLabel: "Thuộc tính" },

    // Quản lý nhà cung cấp
    { key: "GET_SUPPLIER", name: "Xem", module: "supplier", moduleLabel: "Nhà cung cấp" },
    { key: "CREATE_SUPPLIER", name: "Thêm", module: "supplier", moduleLabel: "Nhà cung cấp" },
    { key: "UPDATE_SUPPLIER", name: "Sửa", module: "supplier", moduleLabel: "Nhà cung cấp" },
    { key: "DELETE_SUPPLIER", name: "Xóa", module: "supplier", moduleLabel: "Nhà cung cấp" },

    // Quản lý sản phẩm
    { key: "GET_PRODUCT", name: "Xem", module: "product", moduleLabel: "Sản phẩm" },
    { key: "CREATE_PRODUCT", name: "Thêm", module: "product", moduleLabel: "Sản phẩm" },
    { key: "UPDATE_PRODUCT", name: "Sửa", module: "product", moduleLabel: "Sản phẩm" },
    { key: "DELETE_PRODUCT", name: "Xóa", module: "product", moduleLabel: "Sản phẩm" },

    // Quản lý khuyến mãi
    { key: "GET_PROMOTION", name: "Xem", module: "promotion", moduleLabel: "Khuyến mãi" },
    { key: "CREATE_PROMOTION", name: "Thêm", module: "promotion", moduleLabel: "Khuyến mãi" },
    { key: "UPDATE_PROMOTION", name: "Sửa", module: "promotion", moduleLabel: "Khuyến mãi" },
    { key: "DELETE_PROMOTION", name: "Xóa", module: "promotion", moduleLabel: "Khuyến mãi" },

    // Quản lý khách hàng
    { key: "GET_CUSTOMER", name: "Xem", module: "customer", moduleLabel: "Khách hàng" },
    { key: "CREATE_CUSTOMER", name: "Thêm", module: "customer", moduleLabel: "Khách hàng" },
    { key: "UPDATE_CUSTOMER", name: "Sửa", module: "customer", moduleLabel: "Khách hàng" },
    { key: "DELETE_CUSTOMER", name: "Xóa", module: "customer", moduleLabel: "Khách hàng" },

    // Chăm sóc khách hàng & Nhiệm vụ
    { key: "GET_CUSTOMER_CARE", name: "Xem", module: "crm", moduleLabel: "CSKH & CRM" },
    { key: "CREATE_CUSTOMER_CARE", name: "Thêm", module: "crm", moduleLabel: "CSKH & CRM" },
    { key: "UPDATE_CUSTOMER_CARE", name: "Sửa", module: "crm", moduleLabel: "CSKH & CRM" },
    { key: "DELETE_CUSTOMER_CARE", name: "Xóa", module: "crm", moduleLabel: "CSKH & CRM" },

    { key: "GET_TASK", name: "Xem", module: "task", moduleLabel: "Nhiệm vụ" },
    { key: "CREATE_TASK", name: "Thêm", module: "task", moduleLabel: "Nhiệm vụ" },
    { key: "UPDATE_TASK", name: "Sửa", module: "task", moduleLabel: "Nhiệm vụ" },
    { key: "DELETE_TASK", name: "Xóa", module: "task", moduleLabel: "Nhiệm vụ" },

    // Quản lý hóa đơn / Bán hàng
    { key: "GET_INVOICE", name: "Xem", module: "invoice", moduleLabel: "Đơn bán" },
    { key: "GET_INVOICE_USER", name: "Xem của tôi", module: "invoice", moduleLabel: "Đơn bán" },
    { key: "CREATE_INVOICE", name: "Thêm", module: "invoice", moduleLabel: "Đơn bán" },
    { key: "UPDATE_INVOICE", name: "Sửa", module: "invoice", moduleLabel: "Đơn bán" },
    { key: "DELETE_INVOICE", name: "Xóa", module: "invoice", moduleLabel: "Đơn bán" },
    { key: "APPROVE_INVOICE", name: "Duyệt", module: "invoice", moduleLabel: "Đơn bán" },
    { key: "REJECT_INVOICE", name: "Từ chối", module: "invoice", moduleLabel: "Đơn bán" },
    { key: "CANCEL_INVOICE", name: "Hủy", module: "invoice", moduleLabel: "Đơn bán" },
    { key: "REVERT_INVOICE", name: "Hoàn tác", module: "invoice", moduleLabel: "Đơn bán" },

    // Đơn mua hàng (Purchase Order)
    { key: "GET_PURCHASE_ORDER", name: "Xem", module: "purchase_order", moduleLabel: "Đơn mua hàng" },
    { key: "GET_PURCHASE_ORDER_USER", name: "Xem của tôi", module: "purchase_order", moduleLabel: "Đơn mua hàng" },
    { key: "CREATE_PURCHASE_ORDER", name: "Thêm", module: "purchase_order", moduleLabel: "Đơn mua hàng" },
    { key: "UPDATE_PURCHASE_ORDER", name: "Sửa", module: "purchase_order", moduleLabel: "Đơn mua hàng" },
    { key: "DELETE_PURCHASE_ORDER", name: "Xóa", module: "purchase_order", moduleLabel: "Đơn mua hàng" },
    { key: "APPROVE_PURCHASE_ORDER", name: "Duyệt", module: "purchase_order", moduleLabel: "Đơn mua hàng" },
    { key: "REJECT_PURCHASE_ORDER", name: "Từ chối", module: "purchase_order", moduleLabel: "Đơn mua hàng" },
    { key: "CANCEL_PURCHASE_ORDER", name: "Hủy", module: "purchase_order", moduleLabel: "Đơn mua hàng" },
    { key: "REVERT_PURCHASE_ORDER", name: "Hoàn tác", module: "purchase_order", moduleLabel: "Đơn mua hàng" },

    // Phiếu thu
    { key: "GET_RECEIPT", name: "Xem", module: "receipt", moduleLabel: "Phiếu thu" },
    { key: "GET_RECEIPT_USER", name: "Xem của tôi", module: "receipt", moduleLabel: "Phiếu thu" },
    { key: "CREATE_RECEIPT", name: "Thêm", module: "receipt", moduleLabel: "Phiếu thu" },
    { key: "UPDATE_RECEIPT", name: "Sửa", module: "receipt", moduleLabel: "Phiếu thu" },
    { key: "DELETE_RECEIPT", name: "Xóa", module: "receipt", moduleLabel: "Phiếu thu" },
    { key: "POSTED_RECEIPT", name: "Ghi sổ", module: "receipt", moduleLabel: "Phiếu thu" },
    { key: "CANCEL_RECEIPT", name: "Hủy", module: "receipt", moduleLabel: "Phiếu thu" },

    // Phiếu chi (Payment Voucher)
    { key: "GET_PAYMENT", name: "Xem", module: "payment", moduleLabel: "Phiếu chi" },
    { key: "CREATE_PAYMENT", name: "Thêm", module: "payment", moduleLabel: "Phiếu chi" },
    { key: "UPDATE_PAYMENT", name: "Sửa", module: "payment", moduleLabel: "Phiếu chi" },
    { key: "DELETE_PAYMENT", name: "Xóa", module: "payment", moduleLabel: "Phiếu chi" },
    { key: "POSTED_PAYMENT", name: "Ghi sổ", module: "payment", moduleLabel: "Phiếu chi" },
    { key: "CANCEL_PAYMENT", name: "Hủy", module: "payment", moduleLabel: "Phiếu chi" },

    // Thuế
    { key: "GET_TAX", name: "Xem", module: "tax", moduleLabel: "Thuế" },
    { key: "CREATE_TAX", name: "Thêm", module: "tax", moduleLabel: "Thuế" },
    { key: "UPDATE_TAX", name: "Sửa", module: "tax", moduleLabel: "Thuế" },
    { key: "DELETE_TAX", name: "Xóa", module: "tax", moduleLabel: "Thuế" },

    // Bảo hành
    { key: "GET_WARRANTY", name: "Xem", module: "warranty", moduleLabel: "Bảo hành" },
    { key: "CREATE_WARRANTY", name: "Thêm", module: "warranty", moduleLabel: "Bảo hành" },
    { key: "UPDATE_WARRANTY", name: "Cập nhật", module: "warranty", moduleLabel: "Bảo hành" },
    { key: "DELETE_WARRANTY", name: "Xóa", module: "warranty", moduleLabel: "Bảo hành" },
    { key: "REMIND_WARRANTY", name: "Nhắc nhở", module: "warranty", moduleLabel: "Bảo hành" },

    // Hạn sử dụng
    { key: "GET_EXPIRY", name: "Xem", module: "expiry", moduleLabel: "Hạn sử dụng" },
    { key: "CREATE_EXPIRY", name: "Thêm", module: "expiry", moduleLabel: "Hạn sử dụng" },
    { key: "UPDATE_EXPIRY", name: "Sửa", module: "expiry", moduleLabel: "Hạn sử dụng" },
    { key: "DELETE_EXPIRY", name: "Xóa", module: "expiry", moduleLabel: "Hạn sử dụng" },

    // Công nợ
    { key: "GET_DEBT", name: "Xem", module: "debt", moduleLabel: "Công nợ" },
    { key: "CREATE_DEBT", name: "Thêm", module: "debt", moduleLabel: "Công nợ" },
    { key: "UPDATE_DEBT", name: "Sửa", module: "debt", moduleLabel: "Công nợ" },
    { key: "DELETE_DEBT", name: "Xóa", module: "debt", moduleLabel: "Công nợ" },

    // Nhập kho
    { key: "GET_WAREHOUSE_IMPORT", name: "Xem", module: "warehouse_in", moduleLabel: "Nhập kho" },
    { key: "CREATE_WAREHOUSE_IMPORT", name: "Thêm", module: "warehouse_in", moduleLabel: "Nhập kho" },
    { key: "UPDATE_WAREHOUSE_IMPORT", name: "Cập nhật", module: "warehouse_in", moduleLabel: "Nhập kho" },
    { key: "DELETE_WAREHOUSE_IMPORT", name: "Xóa", module: "warehouse_in", moduleLabel: "Nhập kho" },
    { key: "POSTED_WAREHOUSE_IMPORT", name: "Ghi sổ", module: "warehouse_in", moduleLabel: "Nhập kho" },
    { key: "CANCEL_WAREHOUSE_IMPORT", name: "Hủy", module: "warehouse_in", moduleLabel: "Nhập kho" },

    // Xuất kho
    { key: "GET_WAREHOUSE_EXPORT", name: "Xem", module: "warehouse_out", moduleLabel: "Xuất kho" },
    { key: "CREATE_WAREHOUSE_EXPORT", name: "Thêm", module: "warehouse_out", moduleLabel: "Xuất kho" },
    { key: "UPDATE_WAREHOUSE_EXPORT", name: "Cập nhật", module: "warehouse_out", moduleLabel: "Xuất kho" },
    { key: "DELETE_WAREHOUSE_EXPORT", name: "Xóa", module: "warehouse_out", moduleLabel: "Xuất kho" },
    { key: "POSTED_WAREHOUSE_EXPORT", name: "Ghi sổ", module: "warehouse_out", moduleLabel: "Xuất kho" },
    { key: "CANCEL_WAREHOUSE_EXPORT", name: "Hủy", module: "warehouse_out", moduleLabel: "Xuất kho" },

    // Quản lý kho tổng quát (Optional but matches what user sent)
    { key: "WAREHOUSE_MANAGEMENT", name: "Quản lý kho", module: "warehouse", moduleLabel: "Kho hàng" },

    // Cài đặt
    { key: "GET_SETTING", name: "Xem cài đặt", module: "setting", moduleLabel: "Cài đặt" },
    { key: "GENERAL_SETTING", name: "Cài đặt chung", module: "setting", moduleLabel: "Cài đặt" },
    { key: "NOTIFICATION_SETTING", name: "Cài đặt thông báo", module: "setting", moduleLabel: "Cài đặt" },
    { key: "SYSTEM_SETTING", name: "Cài đặt hệ thống", module: "setting", moduleLabel: "Cài đặt" },
    { key: "GET_STORAGE_SIZE_SETTING", name: "Xem dung lượng lưu trữ", module: "setting", moduleLabel: "Cài đặt" },

    // Báo cáo & Dashboard
    { key: "GET_DASHBOARD", name: "Xem dashboard", module: "report", moduleLabel: "Báo cáo" },
    { key: "GET_REVENUE_REPORT", name: "Xem báo cáo doanh thu", module: "report", moduleLabel: "Báo cáo" },
    { key: "GET_INVENTORY_REPORT", name: "Xem báo cáo tồn kho", module: "report", moduleLabel: "Báo cáo" },
    { key: "GET_SALES_REPORT", name: "Xem báo cáo bán hàng", module: "report", moduleLabel: "Báo cáo" },
    { key: "GET_FINANCIAL_REPORT", name: "Xem báo cáo tài chính", module: "report", moduleLabel: "Báo cáo" },

    // Permissions & Logs
    { key: "GET_PERMISSION", name: "Xem quyền", module: "permission", moduleLabel: "Quyền hạn" },
    { key: "GET_AUDIT_LOG", name: "Xem nhật ký hệ thống", module: "audit_log", moduleLabel: "Nhật ký hệ thống" }
];

async function main() {
    console.log('📝 Seeding ALL permissions...');

    // 1. Upsert all permissions
    const createdFlags = [];
    for (const p of permissionsData) {
        const permission = await prisma.permission.upsert({
            where: { permissionKey: p.key },
            update: { moduleLabel: p.moduleLabel, module: p.module, permissionName: p.name },
            create: {
                permissionKey: p.key,
                permissionName: p.name,
                module: p.module,
                moduleLabel: p.moduleLabel,
            },
        });
        createdFlags.push(permission);
    }
    console.log(`✅ Upserted ${createdFlags.length} permissions into DB.\n`);

    // 2. Give all permissions to the admin role
    const adminRole = await prisma.role.findUnique({
        where: { roleKey: 'admin' },
    });

    if (!adminRole) {
        console.error('❌ Admin role not found!');
        return;
    }

    // Find an admin user to act as `assignedBy`
    const adminUser = await prisma.user.findFirst({
        where: { roleId: adminRole.id }
    });

    let newGrants = 0;
    for (const permission of createdFlags) {
        const exists = await prisma.rolePermission.findUnique({
            where: {
                roleId_permissionId: {
                    roleId: adminRole.id,
                    permissionId: permission.id,
                },
            },
        });

        if (!exists) {
            await prisma.rolePermission.create({
                data: {
                    roleId: adminRole.id,
                    permissionId: permission.id,
                    assignedBy: adminUser?.id || null,
                },
            });
            newGrants++;
        }
    }

    console.log(`✅ Granted ${newGrants} NEW permissions to 'admin' role!`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
