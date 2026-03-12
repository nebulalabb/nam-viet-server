import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fixing Dashboard Permissions...');

    // Get the GET_DASHBOARD permission
    const dashboardPerm = await prisma.permission.findUnique({
        where: { permissionKey: 'GET_DASHBOARD' }
    });

    if (!dashboardPerm) {
        console.log('GET_DASHBOARD permission not found!');
        return;
    }

    // Get all roles
    const roles = await prisma.role.findMany();

    // Assign to all roles
    let count = 0;
    for (const role of roles) {
        // Check if it already exists
        const exists = await prisma.rolePermission.findUnique({
            where: {
                roleId_permissionId: {
                    roleId: role.id,
                    permissionId: dashboardPerm.id
                }
            }
        });

        if (!exists) {
            await prisma.rolePermission.create({
                data: {
                    roleId: role.id,
                    permissionId: dashboardPerm.id,
                    assignedBy: 1 // Admin user ID usually 1
                }
            });
            count++;
            console.log(`Granted GET_DASHBOARD to role: ${role.roleKey}`);
        }
    }

    console.log(`Successfully assigned GET_DASHBOARD to ${count} roles.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
