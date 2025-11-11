import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Moon, Sun } from "lucide-react";
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  MoreVertical,
  Shield,
  ShieldCheck,
  ShieldX,
  Key,
} from "lucide-react";
import Sidebar from "../components/Sidebar";

function UserManagement({ onLogout }) {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    isAdmin: true,
  });

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // all, admin, user

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Filtered and paginated users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesEmail = user.email.toLowerCase().includes(query);
        const matchesName =
          user.name && user.name.toLowerCase().includes(query);
        if (!matchesEmail && !matchesName) return false;
      }

      // Role filter
      if (roleFilter !== "all") {
        if (roleFilter === "admin" && !user.isAdmin) return false;
        if (roleFilter === "user" && user.isAdmin) return false;
      }

      return true;
    });
  }, [users, searchQuery, roleFilter]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get("/admin/users", { headers });
      setUsers(response.data.users);
    } catch (err) {
      setError("Failed to fetch users data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onLogout();
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("adminToken");
      await axios.post("/admin/users", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setShowCreateModal(false);
      setFormData({
        email: "",
        password: "",
        name: "",
        isAdmin: true,
      });
      fetchData();
    } catch (err) {
      setError("Failed to create user");
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("adminToken");
      await axios.put(`/admin/users/${editingUser.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setShowEditModal(false);
      setEditingUser(null);
      setFormData({
        email: "",
        password: "",
        name: "",
        isAdmin: true,
      });
      fetchData();
    } catch (err) {
      setError("Failed to update user");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Delete this user? This action cannot be undone.")) return;

    try {
      const token = localStorage.getItem("adminToken");
      await axios.delete(`/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      fetchData();
    } catch (err) {
      setError("Failed to delete user");
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: "",
      name: user.name || "",
      isAdmin: user.isAdmin,
    });
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <span className="text-lg">Loading Users...</span>
        </div>
      </div>
    );
  }

  return (
    <div data-theme={theme} className="min-h-screen bg-base-200 flex">
      <div className="flex-1 flex flex-col">
        {/* <div className="navbar bg-base-100 shadow-lg">
          <div className="navbar-start">
            <h1 className="text-2xl font-bold text-primary">User Management</h1>
          </div>
        </div> */}

        <div className="w-full p-6 space-y-6">
          {error && (
            <div className="alert alert-error">
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
                Create Admin User
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  className="input input-bordered input-sm pl-10 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  <span className="font-medium">Filters:</span>
                </div>

                <select
                  className="select select-bordered select-sm"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admins</option>
                  <option value="user">Users</option>
                </select>

                {(searchQuery || roleFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setRoleFilter("all");
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>API Keys</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="flex flex-col">
                            <div className="font-medium">{user.email}</div>
                            {user.name && (
                              <div className="text-sm text-gray-500">
                                {user.name}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          {user.isAdmin ? (
                            <div className="badge badge-primary badge-sm">
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Admin
                            </div>
                          ) : (
                            <div className="badge badge-neutral badge-sm">
                              <ShieldX className="w-3 h-3 mr-1" />
                              User
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="badge badge-outline badge-sm">
                            <Key className="w-3 h-3 mr-1" />
                            {user._count.apiKeys}
                          </div>
                        </td>
                        <td className="text-sm">
                          {new Date(user.createdAt).toLocaleDateString()}
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
                                <a onClick={() => openEditModal(user)}>
                                  <Edit className="w-4 h-4" />
                                  Edit
                                </a>
                              </li>
                              <li>
                                <a
                                  onClick={() => handleDeleteUser(user.id)}
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

              {paginatedUsers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No users found matching your criteria.
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages} ({filteredUsers.length}{" "}
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

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">Create Admin User</h3>
            <form onSubmit={handleCreateUser}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Email *</span>
                </label>
                <input
                  type="email"
                  className="input input-bordered"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Password *</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Name (optional)</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div className="form-control mb-6">
                <label className="label">
                  <span className="label-text">Role</span>
                </label>
                <select
                  className="select select-bordered"
                  value={formData.isAdmin}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isAdmin: e.target.value === "true",
                    })
                  }
                >
                  <option value={true}>Admin</option>
                  <option value={false}>User</option>
                </select>
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
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">Edit User</h3>
            <form onSubmit={handleEditUser}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Email *</span>
                </label>
                <input
                  type="email"
                  className="input input-bordered"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">
                    New Password (leave empty to keep current)
                  </span>
                </label>
                <input
                  type="password"
                  className="input input-bordered"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Name (optional)</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div className="form-control mb-6">
                <label className="label">
                  <span className="label-text">Role</span>
                </label>
                <select
                  className="select select-bordered"
                  value={formData.isAdmin}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isAdmin: e.target.value === "true",
                    })
                  }
                >
                  <option value={true}>Admin</option>
                  <option value={false}>User</option>
                </select>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
