const prisma = require('../prisma/client');

/**
 * Create a new role
 */
async function createRole(req, res) {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const existingRole = await prisma.role.findUnique({
      where: { name }
    });

    if (existingRole) {
      return res.status(409).json({ error: 'Role with this name already exists' });
    }

    const role = await prisma.role.create({
      data: { name, description }
    });

    res.status(201).json(role);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create role' });
  }
}

/**
 * Get all roles
 */
async function getRoles(req, res) {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: { userRoles: true }
        },
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });

    res.json({ roles });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
}

/**
 * Update a role
 */
async function updateRole(req, res) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const role = await prisma.role.update({
      where: { id: parseInt(id) },
      data: { name, description }
    });

    res.json(role);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.status(500).json({ error: 'Failed to update role' });
  }
}

/**
 * Delete a role
 */
async function deleteRole(req, res) {
  try {
    const { id } = req.params;

    await prisma.role.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.status(500).json({ error: 'Failed to delete role' });
  }
}

/**
 * Assign role to user
 */
async function assignRoleToUser(req, res) {
  try {
    const { userId, roleId } = req.body;

    if (!userId || !roleId) {
      return res.status(400).json({ error: 'userId and roleId are required' });
    }

    const userRole = await prisma.userRole.create({
      data: {
        userId: parseInt(userId),
        roleId: parseInt(roleId)
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        role: true
      }
    });

    res.status(201).json(userRole);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'User already has this role' });
    }
    res.status(500).json({ error: 'Failed to assign role' });
  }
}

/**
 * Remove role from user
 */
async function removeRoleFromUser(req, res) {
  try {
    const { userId, roleId } = req.params;

    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId: parseInt(userId),
          roleId: parseInt(roleId)
        }
      }
    });

    res.json({ message: 'Role removed from user successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User role assignment not found' });
    }
    res.status(500).json({ error: 'Failed to remove role' });
  }
}

/**
 * Get user roles
 */
async function getUserRoles(req, res) {
  try {
    const { userId } = req.params;

    const userRoles = await prisma.userRole.findMany({
      where: { userId: parseInt(userId) },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    res.json({ userRoles });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user roles' });
  }
}

/**
 * Create a new permission
 */
async function createPermission(req, res) {
  try {
    const { name, description, resource, action } = req.body;

    if (!name || !resource || !action) {
      return res.status(400).json({ error: 'name, resource, and action are required' });
    }

    const existingPermission = await prisma.permission.findUnique({
      where: { name }
    });

    if (existingPermission) {
      return res.status(409).json({ error: 'Permission with this name already exists' });
    }

    const permission = await prisma.permission.create({
      data: { name, description, resource, action }
    });

    res.status(201).json(permission);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create permission' });
  }
}

/**
 * Get all permissions
 */
async function getPermissions(req, res) {
  try {
    const permissions = await prisma.permission.findMany({
      include: {
        _count: {
          select: { rolePermissions: true }
        }
      }
    });

    res.json({ permissions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
}

/**
 * Assign permission to role
 */
async function assignPermissionToRole(req, res) {
  try {
    const { roleId, permissionId } = req.body;

    if (!roleId || !permissionId) {
      return res.status(400).json({ error: 'roleId and permissionId are required' });
    }

    const rolePermission = await prisma.rolePermission.create({
      data: {
        roleId: parseInt(roleId),
        permissionId: parseInt(permissionId)
      },
      include: {
        role: true,
        permission: true
      }
    });

    res.status(201).json(rolePermission);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Role already has this permission' });
    }
    res.status(500).json({ error: 'Failed to assign permission' });
  }
}

/**
 * Remove permission from role
 */
async function removePermissionFromRole(req, res) {
  try {
    const { roleId, permissionId } = req.params;

    await prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId: parseInt(roleId),
          permissionId: parseInt(permissionId)
        }
      }
    });

    res.json({ message: 'Permission removed from role successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Role permission assignment not found' });
    }
    res.status(500).json({ error: 'Failed to remove permission' });
  }
}

module.exports = {
  createRole,
  getRoles,
  updateRole,
  deleteRole,
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles,
  createPermission,
  getPermissions,
  assignPermissionToRole,
  removePermissionFromRole
};