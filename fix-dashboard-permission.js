// Quick script to ensure admin role has GET_DASHBOARD permission
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    // Find admin role
    const adminRole = await p.role.findFirst({ where: { roleKey: 'admin' } });
    if (!adminRole) { console.log('Admin role not found'); return; }
    console.log('Admin role id:', adminRole.id);

    // Find total permissions for admin
    const totalPerms = await p.rolePermission.count({ where: { roleId: adminRole.id } });
    console.log('Total admin permissions:', totalPerms);

    // Check GET_DASHBOARD
    const dashPerm = await p.permission.findFirst({ where: { permissionKey: 'GET_DASHBOARD' } });
    if (!dashPerm) {
        console.log('GET_DASHBOARD permission does not exist in DB. Creating...');
        const created = await p.permission.create({
            data: { permissionKey: 'GET_DASHBOARD', permissionName: 'Xem dashboard', module: 'report' }
        });
        await p.rolePermission.create({ data: { roleId: adminRole.id, permissionId: created.id } });
        console.log('Created and assigned GET_DASHBOARD to admin');
        return;
    }
    console.log('GET_DASHBOARD permission id:', dashPerm.id);

    // Check if admin already has it
    const existing = await p.rolePermission.findFirst({ where: { roleId: adminRole.id, permissionId: dashPerm.id } });
    if (existing) {
        console.log('Admin already has GET_DASHBOARD - permission is in DB');
    } else {
        await p.rolePermission.create({ data: { roleId: adminRole.id, permissionId: dashPerm.id } });
        console.log('Assigned GET_DASHBOARD to admin role');
    }

    // Now also check if the 400 could be from report.service not finding the enum
    console.log('\nListing sample invoice statuses:');
    const statuses = await p.invoice.findMany({ select: { orderStatus: true }, take: 5 });
    console.log(statuses.map(s => s.orderStatus));
}

run().then(() => p.$disconnect()).catch(e => { console.error(e.message); p.$disconnect(); });
