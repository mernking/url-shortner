import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Tag,
  Plus,
  Search,
  Edit,
  Trash2,
  MoreVertical,
  Hash,
  AlertTriangle,
} from "lucide-react";
import Sidebar from "../components/Sidebar";

function TagManagement({ onLogout }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
  });

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const filteredTags = useMemo(() => {
    return tags.filter((tag) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = tag.name.toLowerCase().includes(query);
        const matchesDescription = tag.description
          ?.toLowerCase()
          .includes(query);
        if (!matchesName && !matchesDescription) return false;
      }
      return true;
    });
  }, [tags, searchQuery]);

  const paginatedTags = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTags.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTags, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredTags.length / itemsPerPage);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get("/admin/tags", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTags(response.data.tags);
    } catch (err) {
      setError("Failed to fetch tags");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("adminToken");
      await axios.post("/admin/tags", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setShowCreateModal(false);
      setFormData({ name: "", description: "", color: "#3B82F6" });
      fetchTags();
    } catch (err) {
      setError("Failed to create tag");
    }
  };

  const handleEditTag = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("adminToken");
      await axios.put(`/admin/tags/${editingTag.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setShowEditModal(false);
      setEditingTag(null);
      setFormData({ name: "", description: "", color: "#3B82F6" });
      fetchTags();
    } catch (err) {
      setError("Failed to update tag");
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (!confirm("Delete this tag? This action cannot be undone.")) return;

    try {
      const token = localStorage.getItem("adminToken");
      await axios.delete(`/admin/tags/${tagId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      fetchTags();
    } catch (err) {
      setError("Failed to delete tag");
    }
  };

  const openEditModal = (tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      description: tag.description || "",
      color: tag.color || "#3B82F6",
    });
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <span className="text-lg">Loading Tag Management...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex">
      <div className="flex-1 flex flex-col">
        {/* <div className="navbar bg-base-100 shadow-lg">
          <div className="navbar-start">
            <h1 className="text-2xl font-bold text-primary">Tag Management</h1>
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
                Create Tag
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tags..."
                  className="input input-bordered input-sm pl-10 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tags Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedTags.map((tag) => (
              <div key={tag.id} className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: tag.color || "#3B82F6" }}
                      ></div>
                      <div>
                        <h3 className="card-title text-lg flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          {tag.name}
                        </h3>
                        {tag.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {tag.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="dropdown dropdown-left">
                      <label tabIndex={0} className="btn btn-ghost btn-xs">
                        <MoreVertical className="w-4 h-4" />
                      </label>
                      <ul
                        tabIndex={0}
                        className="dropdown-content z-10 menu p-2 shadow bg-base-100 rounded-box w-32"
                      >
                        <li>
                          <a onClick={() => openEditModal(tag)}>
                            <Edit className="w-4 h-4" />
                            Edit
                          </a>
                        </li>
                        <li>
                          <a
                            onClick={() => handleDeleteTag(tag.id)}
                            className="text-error"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="card-actions justify-end mt-4">
                    <div className="badge badge-outline badge-sm">
                      Links: {tag._count?.links || 0}
                    </div>
                    <div className="badge badge-outline badge-sm">
                      Created: {new Date(tag.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {paginatedTags.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No tags found matching your criteria.
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
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
                    Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
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

      {/* Create Tag Modal */}
      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">Create Tag</h3>
            <form onSubmit={handleCreateTag}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Tag Name *</span>
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
                  <span className="label-text">Color</span>
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    className="w-12 h-10 rounded border border-base-300"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    className="input input-bordered flex-1"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    placeholder="#3B82F6"
                  />
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
                  Create Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {showEditModal && editingTag && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">Edit Tag</h3>
            <form onSubmit={handleEditTag}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Tag Name *</span>
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
                  <span className="label-text">Color</span>
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    className="w-12 h-10 rounded border border-base-300"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    className="input input-bordered flex-1"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    placeholder="#3B82F6"
                  />
                </div>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingTag(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TagManagement;
