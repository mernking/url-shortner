import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Plus,
  Search,
  Edit,
  Trash2,
  MoreVertical,
  Users,
  Key,
  AlertTriangle,
} from "lucide-react";
import Sidebar from "../components/Sidebar";

function RoleManagement({ onLogout }) {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [],
  });

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = role.name.toLowerCase().includes(query);
        const matchesDescription = role.description
          ?.toLowerCase()
          .includes(query);
        if (!matchesName && !matchesDescription) return false;
      }
      return true;
    });
  }, [roles, searchQuery]);

  const paginatedRoles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRoles.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRoles, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredRoles.length / itemsPerPage);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const headers = { Authorization: `Bearer ${token}` };

      const [rolesResponse, permissionsResponse] = await Promise.all([
        axios.get("/admin/roles", { headers }),
        axios.get("/admin/permissions", { headers }),
      ]);

      setRoles(rolesResponse.data.roles);
      setPermissions(permissionsResponse.data.permissions);
    } catch (err) {
      setError("Failed to fetch roles and permissions");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("adminToken");
      await axios.post("/admin/roles", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setShowCreateModal(false);
      setFormData({ name: "", description: "", permissions: [] });
      fetchData();
    } catch (err) {
      setError("Failed to create role");
    }
  };

  const handleEditRole = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("adminToken");
      await axios.put(`/admin/roles/${editingRole.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setShowEditModal(false);
      setEditingRole(null);
      setFormData({ name: "", description: "", permissions: [] });
      fetchData();
    } catch (err) {
      setError("Failed to update role");
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!confirm("Delete this role? This action cannot be undone.")) return;

    try {
      const token = localStorage.getItem("adminToken");
      await axios.delete(`/admin/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      fetchData();
    } catch (err) {
      setError("Failed to delete role");
    }
  };

  const openEditModal = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions?.map((p) => p.id) || [],
    });
    setShowEditModal(true);
  };

  const handlePermissionToggle = (permissionId) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((id) => id !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <span className="text-lg">Loading Role Management...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex">
      <div className="flex-1 flex flex-col">
        {/* <div className="navbar bg-base-100 shadow-lg">
          <div className="navbar-start">
            <h1 className="text-2xl font-bold text-primary">Role Management</h1>
          </div>
        </div> */}

        <div className="w-full p-6 space-y-6">
          {error && (
            <div className="alert alert-error">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary"
              >
                <Plus className="w-4 h-4" />
                Create Role
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search roles..."
                  className="input input-bordered input-sm pl-10 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Roles Table */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Role Name</th>
                      <th>Description</th>
                      <th>Permissions</th>
                      <th>Users Count</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRoles.map((role) => (
                      <tr key={role.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            <span className="font-medium">{role.name}</span>
                          </div>
                        </td>
                        <td className="max-w-xs truncate">
                          {role.description || "No description"}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {role.permissions?.slice(0, 3).map((permission) => (
                              <div
                                key={permission.id}
                                className="badge badge-outline badge-sm"
                              >
                                {permission.name}
                              </div>
                            ))}
                            {role.permissions?.length > 3 && (
                              <div className="badge badge-outline badge-sm">
                                +{role.permissions.length - 3} more
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="badge badge-neutral badge-sm">
                            <Users className="w-3 h-3 mr-1" />
                            {role._count?.users || 0}
                          </div>
                        </td>
                        <td className="text-sm">
                          {new Date(role.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="dropdown dropdown-left">
                            <label
                              tabIndex={0}
                              className="btn btn-ghost btn-xs"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </label>
                            <ul
                              tabIndex={0}
                              className="dropdown-content z-10 menu p-2 shadow bg-base-100 rounded-box w-32"
                            >
                              <li>
                                <a onClick={() => openEditModal(role)}>
                                  <Edit className="w-4 h-4" />
                                  Edit
                                </a>
                              </li>
                              <li>
                                <a
                                  onClick={() => handleDeleteRole(role.id)}
                                  className="text-error"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </a>
                              </li>
                            </ul>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {paginatedRoles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No roles found matching your criteria.
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages} ({filteredRoles.length}{" "}
                    total)
                  </div>
                  <div className="join">
                    <button
                      className="join-item btn btn-sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum =
                        Math.max(1, Math.min(totalPages - 4, currentPage - 2)) +
                        i;
                      if (pageNum > totalPages) return null;
                      return (
                        <button
                          key={pageNum}
                          className={`join-item btn btn-sm ${
                            currentPage === pageNum ? "btn-active" : ""
                          }`}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      className="join-item btn btn-sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Create Role</h3>
            <form onSubmit={handleCreateRole}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Role Name *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="form-control mb-6">
                <label className="label">
                  <span className="label-text">Permissions</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-base-300 rounded-lg p-3">
                  {permissions.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={formData.permissions.includes(permission.id)}
                        onChange={() => handlePermissionToggle(permission.id)}
                      />
                      <span className="text-sm">{permission.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && editingRole && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Edit Role</h3>
            <form onSubmit={handleEditRole}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Role Name *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="form-control mb-6">
                <label className="label">
                  <span className="label-text">Permissions</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-base-300 rounded-lg p-3">
                  {permissions.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={formData.permissions.includes(permission.id)}
                        onChange={() => handlePermissionToggle(permission.id)}
                      />
                      <span className="text-sm">{permission.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingRole(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoleManagement;
