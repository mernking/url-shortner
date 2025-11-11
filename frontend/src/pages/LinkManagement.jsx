import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Link as LinkIcon,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  MoreVertical,
  Calendar,
  Lock,
  Tag,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  LogOut,
  BarChart3,
  UserCog,
  Server,
} from "lucide-react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";

function LinkManagement({ onLogout }) {
  const [links, setLinks] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLinks, setSelectedLinks] = useState([]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLink, setEditingLink] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    destination: "",
    slug: "",
    title: "",
    password: "",
    expiresAt: "",
    tags: [],
  });

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, active, expired
  const [passwordFilter, setPasswordFilter] = useState("all"); // all, protected, unprotected
  const [selectedTags, setSelectedTags] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Filtered and paginated links
  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSlug = link.slug.toLowerCase().includes(query);
        const matchesDestination = link.destination
          .toLowerCase()
          .includes(query);
        const matchesTitle =
          link.title && link.title.toLowerCase().includes(query);
        if (!matchesSlug && !matchesDestination && !matchesTitle) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (
          statusFilter === "expired" &&
          (!link.expiresAt || new Date(link.expiresAt) > new Date())
        )
          return false;
        if (
          statusFilter === "active" &&
          link.expiresAt &&
          new Date(link.expiresAt) <= new Date()
        )
          return false;
      }

      // Password filter
      if (passwordFilter !== "all") {
        if (passwordFilter === "protected" && !link.password) return false;
        if (passwordFilter === "unprotected" && link.password) return false;
      }

      // Tags filter
      if (selectedTags.length > 0) {
        const linkTagNames = link.tags.map((tag) => tag.name);
        if (!selectedTags.every((tag) => linkTagNames.includes(tag)))
          return false;
      }

      return true;
    });
  }, [links, searchQuery, statusFilter, passwordFilter, selectedTags]);

  const paginatedLinks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLinks.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLinks, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredLinks.length / itemsPerPage);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const headers = { Authorization: `Bearer ${token}` };

      const [linksResponse, tagsResponse] = await Promise.all([
        axios.get("/admin/links", { headers }),
        axios.get("/admin/tags", { headers }),
      ]);

      setLinks(linksResponse.data.links);
      setTags(tagsResponse.data.tags);
    } catch (err) {
      setError("Failed to fetch links data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onLogout();
  };

  const handleSelectLink = (linkId) => {
    setSelectedLinks((prev) =>
      prev.includes(linkId)
        ? prev.filter((id) => id !== linkId)
        : [...prev, linkId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLinks.length === paginatedLinks.length) {
      setSelectedLinks([]);
    } else {
      setSelectedLinks(paginatedLinks.map((link) => link.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedLinks.length) return;

    if (!confirm(`Delete ${selectedLinks.length} selected link(s)?`)) return;

    try {
      const token = localStorage.getItem("adminToken");
      await axios.delete("/admin/links", {
        data: { ids: selectedLinks },
        headers: { Authorization: `Bearer ${token}` },
      });

      setSelectedLinks([]);
      fetchData();
    } catch (err) {
      setError("Failed to delete links");
    }
  };

  const handleCreateLink = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("adminToken");
      await axios.post("/admin/links", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setShowCreateModal(false);
      setFormData({
        destination: "",
        slug: "",
        title: "",
        password: "",
        expiresAt: "",
        tags: [],
      });
      fetchData();
    } catch (err) {
      setError("Failed to create link");
    }
  };

  const handleEditLink = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("adminToken");
      await axios.put(`/admin/links/${editingLink.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setShowEditModal(false);
      setEditingLink(null);
      setFormData({
        destination: "",
        slug: "",
        title: "",
        password: "",
        expiresAt: "",
        tags: [],
      });
      fetchData();
    } catch (err) {
      setError("Failed to update link");
    }
  };

  const handleDeleteLink = async (linkId) => {
    if (!confirm("Delete this link?")) return;

    try {
      const token = localStorage.getItem("adminToken");
      await axios.delete(`/admin/links/${linkId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      fetchData();
    } catch (err) {
      setError("Failed to delete link");
    }
  };

  const openEditModal = (link) => {
    setEditingLink(link);
    setFormData({
      destination: link.destination,
      slug: link.slug,
      title: link.title || "",
      password: "",
      expiresAt: link.expiresAt
        ? new Date(link.expiresAt).toISOString().slice(0, 16)
        : "",
      tags: link.tags.map((tag) => tag.name),
    });
    setShowEditModal(true);
  };

  const isExpired = (expiresAt) => {
    return expiresAt && new Date(expiresAt) <= new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <span className="text-lg">Loading Links...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex">
      {/* Header */}
      {/* <div className="navbar bg-base-100 shadow-lg">
        <div className="navbar-start">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-primary">Link Management</h1>
          </div>
        </div>
        <div className="navbar-end">
          <Link to="/dashboard" className="btn btn-outline btn-primary mr-2">
            <Server className="w-4 h-4" />
            Dashboard
          </Link>
          <Link to="/analytics" className="btn btn-outline btn-secondary mr-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Link>
          <Link to="/users" className="btn btn-outline btn-accent mr-2">
            <UserCog className="w-4 h-4" />
            Users
          </Link>
          <button onClick={handleLogout} className="btn btn-outline btn-error">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div> */}

      <div className="container mx-auto p-6 space-y-6">
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
              Create Link
            </button>

            {selectedLinks.length > 0 && (
              <button onClick={handleBulkDelete} className="btn btn-error">
                <Trash2 className="w-4 h-4" />
                Delete ({selectedLinks.length})
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search links..."
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
                <Filter className="w-4 h-4" />
                <span className="font-medium">Filters:</span>
              </div>

              <select
                className="select select-bordered select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>

              <select
                className="select select-bordered select-sm"
                value={passwordFilter}
                onChange={(e) => setPasswordFilter(e.target.value)}
              >
                <option value="all">All Protection</option>
                <option value="protected">Password Protected</option>
                <option value="unprotected">No Password</option>
              </select>

              <div className="dropdown dropdown-hover">
                <label tabIndex={0} className="btn btn-outline btn-sm">
                  <Tag className="w-4 h-4 mr-2" />
                  Tags ({selectedTags.length})
                </label>
                <ul
                  tabIndex={0}
                  className="dropdown-content z-10 menu p-2 shadow bg-base-100 rounded-box w-52"
                >
                  {tags.map((tag) => (
                    <li key={tag.id}>
                      <label className="cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTags((prev) => [...prev, tag.name]);
                            } else {
                              setSelectedTags((prev) =>
                                prev.filter((t) => t !== tag.name)
                              );
                            }
                          }}
                          className="checkbox checkbox-sm"
                        />
                        {tag.name} ({tag._count.links})
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              {(searchQuery ||
                statusFilter !== "all" ||
                passwordFilter !== "all" ||
                selectedTags.length > 0) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setPasswordFilter("all");
                    setSelectedTags([]);
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Links Table */}
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th className="w-12">
                      <button
                        onClick={handleSelectAll}
                        className="btn btn-ghost btn-xs"
                      >
                        {selectedLinks.length === paginatedLinks.length &&
                        paginatedLinks.length > 0 ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th>Link</th>
                    <th>Destination</th>
                    <th>Status</th>
                    <th>Clicks</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLinks.map((link) => (
                    <tr key={link.id}>
                      <td>
                        <button
                          onClick={() => handleSelectLink(link.id)}
                          className="btn btn-ghost btn-xs"
                        >
                          {selectedLinks.includes(link.id) ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <div className="font-medium">{link.slug}</div>
                          {link.title && (
                            <div className="text-sm text-gray-500">
                              {link.title}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="max-w-xs truncate font-mono text-sm">
                        {link.destination}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {isExpired(link.expiresAt) ? (
                            <div className="badge badge-error badge-sm">
                              Expired
                            </div>
                          ) : link.expiresAt ? (
                            <div className="badge badge-warning badge-sm">
                              Expires Soon
                            </div>
                          ) : (
                            <div className="badge badge-success badge-sm">
                              Active
                            </div>
                          )}
                          {link.password && <Lock className="w-3 h-3" />}
                        </div>
                      </td>
                      <td>{link.clicksCount || 0}</td>
                      <td className="text-sm">
                        {new Date(link.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="dropdown dropdown-left">
                          <label tabIndex={0} className="btn btn-ghost btn-xs">
                            <MoreVertical className="w-4 h-4" />
                          </label>
                          <ul
                            tabIndex={0}
                            className="dropdown-content z-10 menu p-2 shadow bg-base-100 rounded-box w-32"
                          >
                            <li>
                              <a onClick={() => openEditModal(link)}>
                                <Edit className="w-4 h-4" />
                                Edit
                              </a>
                            </li>
                            <li>
                              <a
                                onClick={() => handleDeleteLink(link.id)}
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

            {paginatedLinks.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No links found matching your criteria.
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages} ({filteredLinks.length}{" "}
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

      {/* Create Link Modal */}
      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">Create New Link</h3>
            <form onSubmit={handleCreateLink}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Destination URL *</span>
                </label>
                <input
                  type="url"
                  className="input input-bordered"
                  value={formData.destination}
                  onChange={(e) =>
                    setFormData({ ...formData, destination: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Slug (optional)</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Title (optional)</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Password (optional)</span>
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
                  <span className="label-text">Expires At (optional)</span>
                </label>
                <input
                  type="datetime-local"
                  className="input input-bordered"
                  value={formData.expiresAt}
                  onChange={(e) =>
                    setFormData({ ...formData, expiresAt: e.target.value })
                  }
                />
              </div>

              <div className="form-control mb-6">
                <label className="label">
                  <span className="label-text">Tags (comma-separated)</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.tags.join(", ")}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter((t) => t),
                    })
                  }
                  placeholder="tag1, tag2, tag3"
                />
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
                  Create Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Link Modal */}
      {showEditModal && editingLink && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">Edit Link</h3>
            <form onSubmit={handleEditLink}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Destination URL *</span>
                </label>
                <input
                  type="url"
                  className="input input-bordered"
                  value={formData.destination}
                  onChange={(e) =>
                    setFormData({ ...formData, destination: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Slug</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Title (optional)</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
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
                  <span className="label-text">Expires At (optional)</span>
                </label>
                <input
                  type="datetime-local"
                  className="input input-bordered"
                  value={formData.expiresAt}
                  onChange={(e) =>
                    setFormData({ ...formData, expiresAt: e.target.value })
                  }
                />
              </div>

              <div className="form-control mb-6">
                <label className="label">
                  <span className="label-text">Tags (comma-separated)</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.tags.join(", ")}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter((t) => t),
                    })
                  }
                  placeholder="tag1, tag2, tag3"
                />
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingLink(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LinkManagement;
