import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Activity,
  Search,
  Filter,
  Calendar,
  User,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Download,
} from "lucide-react";
import Sidebar from "../components/Sidebar";

function ActivityLogs({ onLogout }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search query (user, action, description)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesUser = log.user?.email?.toLowerCase().includes(query);
        const matchesAction = log.action?.toLowerCase().includes(query);
        const matchesDescription = log.description
          ?.toLowerCase()
          .includes(query);
        if (!matchesUser && !matchesAction && !matchesDescription) return false;
      }

      // Action filter
      if (actionFilter && log.action !== actionFilter) return false;

      // User filter
      if (userFilter && log.user?.email !== userFilter) return false;

      // Date range filter
      if (dateFrom || dateTo) {
        const logDate = new Date(log.timestamp);
        if (dateFrom && logDate < new Date(dateFrom)) return false;
        if (dateTo && logDate > new Date(dateTo + "T23:59:59")) return false;
      }

      return true;
    });
  }, [logs, searchQuery, actionFilter, userFilter, dateFrom, dateTo]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get("/admin/activity-logs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(response.data.logs);
    } catch (err) {
      setError("Failed to fetch activity logs");
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case "login":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "logout":
        return <XCircle className="w-4 h-4 text-neutral" />;
      case "create":
        return <Shield className="w-4 h-4 text-primary" />;
      case "update":
        return <Eye className="w-4 h-4 text-warning" />;
      case "delete":
        return <XCircle className="w-4 h-4 text-error" />;
      default:
        return <Activity className="w-4 h-4 text-neutral" />;
    }
  };

  const getActionBadge = (action) => {
    const baseClasses = "badge badge-sm";
    switch (action) {
      case "login":
        return `${baseClasses} badge-success`;
      case "logout":
        return `${baseClasses} badge-neutral`;
      case "create":
        return `${baseClasses} badge-primary`;
      case "update":
        return `${baseClasses} badge-warning`;
      case "delete":
        return `${baseClasses} badge-error`;
      default:
        return `${baseClasses} badge-ghost`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <span className="text-lg">Loading Activity Logs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex">
      <div className="flex-1 flex flex-col">
        {/* <div className="navbar bg-base-100 shadow-lg">
          <div className="navbar-start">
            <h1 className="text-2xl font-bold text-primary">Activity Logs</h1>
          </div>
        </div> */}

        <div className="w-full p-6 space-y-6">
          {error && (
            <div className="alert alert-error">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Filters */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    className="input input-bordered input-sm pl-10 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <select
                  className="select select-bordered select-sm"
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                >
                  <option value="">All Actions</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                </select>

                <select
                  className="select select-bordered select-sm"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                >
                  <option value="">All Users</option>
                  {[
                    ...new Set(
                      logs.map((log) => log.user?.email).filter(Boolean)
                    ),
                  ]
                    .sort()
                    .map((email) => (
                      <option key={email} value={email}>
                        {email}
                      </option>
                    ))}
                </select>

                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="From Date"
                />

                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="To Date"
                />
              </div>

              {(searchQuery ||
                actionFilter ||
                userFilter ||
                dateFrom ||
                dateTo) && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setActionFilter("");
                      setUserFilter("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    Clear Filters
                  </button>
                  <button className="btn btn-primary btn-sm">
                    <Download className="w-4 h-4" />
                    Export Logs
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Results Summary */}
          <div className="text-sm text-base-content/70">
            Showing {paginatedLogs.length} of {filteredLogs.length} logs
          </div>

          {/* Logs Table */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="overflow-x-auto max-h-96">
                <table className="table table-zebra w-full">
                  <thead className="sticky top-0 bg-base-100">
                    <tr>
                      <th>Time</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Description</th>
                      <th>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="text-sm font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-neutral" />
                            <span className="font-medium">
                              {log.user?.email || "System"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div
                            className={`badge ${getActionBadge(log.action)}`}
                          >
                            {getActionIcon(log.action)}
                            <span className="ml-1 capitalize">
                              {log.action}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-xs truncate">{log.description}</td>
                        <td className="font-mono text-sm">{log.ipAddress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {paginatedLogs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No activity logs found matching your criteria.
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-base-content/70">
                    Page {currentPage} of {totalPages}
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
    </div>
  );
}

export default ActivityLogs;
