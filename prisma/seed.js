const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default permissions
  const permissions = [
    // User management permissions
    { name: 'users.read', description: 'View users', resource: 'users', action: 'read' },
    { name: 'users.create', description: 'Create users', resource: 'users', action: 'create' },
    { name: 'users.update', description: 'Update users', resource: 'users', action: 'update' },
    { name: 'users.delete', description: 'Delete users', resource: 'users', action: 'delete' },

    // Role management permissions
    { name: 'roles.read', description: 'View roles', resource: 'roles', action: 'read' },
    { name: 'roles.create', description: 'Create roles', resource: 'roles', action: 'create' },
    { name: 'roles.update', description: 'Update roles', resource: 'roles', action: 'update' },
    { name: 'roles.delete', description: 'Delete roles', resource: 'roles', action: 'delete' },

    // Permission management permissions
    { name: 'permissions.read', description: 'View permissions', resource: 'permissions', action: 'read' },
    { name: 'permissions.create', description: 'Create permissions', resource: 'permissions', action: 'create' },

    // Link management permissions
    { name: 'links.read', description: 'View links', resource: 'links', action: 'read' },
    { name: 'links.create', description: 'Create links', resource: 'links', action: 'create' },
    { name: 'links.update', description: 'Update links', resource: 'links', action: 'update' },
    { name: 'links.delete', description: 'Delete links', resource: 'links', action: 'delete' },

    // Analytics permissions
    { name: 'analytics.read', description: 'View analytics', resource: 'analytics', action: 'read' },

    // System permissions
    { name: 'logs.read', description: 'View system logs', resource: 'logs', action: 'read' },
    { name: 'activity.read', description: 'View activity logs', resource: 'activity', action: 'read' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  // Create default roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrator with full access',
    },
  });

  const moderatorRole = await prisma.role.upsert({
    where: { name: 'moderator' },
    update: {},
    create: {
      name: 'moderator',
      description: 'Moderator with limited admin access',
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Regular user',
    },
  });

  // Assign all permissions to admin role
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    try {
      await prisma.rolePermission.create({
        data: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
    }
  }

  // Assign some permissions to moderator role
  const moderatorPermissions = await prisma.permission.findMany({
    where: {
      name: {
        in: ['users.read', 'links.read', 'links.create', 'links.update', 'links.delete', 'analytics.read']
      }
    }
  });
  for (const perm of moderatorPermissions) {
    try {
      await prisma.rolePermission.create({
        data: {
          roleId: moderatorRole.id,
          permissionId: perm.id,
        },
      });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
    }
  }

  // Assign basic permissions to user role
  const userPermissions = await prisma.permission.findMany({
    where: {
      name: {
        in: ['links.read', 'links.create', 'links.update']
      }
    }
  });
  for (const perm of userPermissions) {
    try {
      await prisma.rolePermission.create({
        data: {
          roleId: userRole.id,
          permissionId: perm.id,
        },
      });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
    }
  }

  // Create a default admin user if one doesn't exist
  const adminEmail = 'admin@example.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'System Admin',
        isAdmin: true,
      },
    });

    // Assign admin role to admin user
    await prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    });

    console.log('Default admin user created: admin@example.com / admin123');
  }

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });