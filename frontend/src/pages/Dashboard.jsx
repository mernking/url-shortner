import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Moon, Sun } from "lucide-react";
import MapComponent from "../components/MapComponent";
import GlobeComponent from "../components/GlobeComponent";
import Sidebar from "../components/Sidebar";
import {
  Activity,
  Globe as GlobeIcon,
  MapPin,
  TrendingUp,
  Users,
  Globe,
  Server,
  BarChart3,
} from "lucide-react";

function Dashboard({ onLogout }) {
  const [stats, setStats] = useState({});
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  // Filter states
  const [methodFilter, setMethodFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // Fixed at 50 for performance

  // Filtered logs based on active filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Method filter
      if (methodFilter && log.method !== methodFilter) return false;

      // Country filter
      if (countryFilter && log.country !== countryFilter) return false;

      // Date range filter
      if (dateFrom || dateTo) {
        const logDate = new Date(log.time);
        if (dateFrom && logDate < new Date(dateFrom)) return false;
        if (dateTo && logDate > new Date(dateTo + "T23:59:59")) return false;
      }

      // Search query (path or IP)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesPath = log.path.toLowerCase().includes(query);
        const matchesIP = log.ip && log.ip.toLowerCase().includes(query);
        if (!matchesPath && !matchesIP) return false;
      }

      return true;
    });
  }, [logs, methodFilter, countryFilter, dateFrom, dateTo, searchQuery]);

  // Paginated logs
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  // Total pages
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  useEffect(() => {
    fetchData();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const headers = { Authorization: `Bearer ${token}` };

      const [statsResponse, logsResponse] = await Promise.all([
        axios.get("/admin/stats", { headers }),
        axios.get("/admin/logs", { headers }),
      ]);

      setStats(statsResponse.data);
      setLogs(logsResponse.data.logs);
    } catch (err) {
      setError("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 animate-pulse" />
            <span className="text-lg">Loading Dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-theme={theme} className="min-h-screen bg-base-200 flex">
      <div className="flex-1 flex flex-col">
        {/* <div className="navbar bg-base-100 shadow-lg">
          <div className="navbar-start">
            <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          </div>
           */}

        <div className="w-full p-6 space-y-6">
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="card-title text-sm opacity-70 uppercase tracking-wide">
                      Total Requests
                    </h3>
                    <p className="text-4xl font-bold text-primary">
                      {stats.totalRequests || 0}
                    </p>
                    <p className="text-sm opacity-60">All time requests</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-secondary/10 rounded-lg">
                    <Users className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="card-title text-sm opacity-70 uppercase tracking-wide">
                      Unique IPs
                    </h3>
                    <p className="text-4xl font-bold text-secondary">
                      {stats.uniqueIPs || 0}
                    </p>
                    <p className="text-sm opacity-60">Distinct IP addresses</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-accent/10 rounded-lg">
                    <GlobeIcon className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="card-title text-sm opacity-70 uppercase tracking-wide">
                      Unique Countries
                    </h3>
                    <p className="text-4xl font-bold text-accent">
                      {stats.uniqueCountries || 0}
                    </p>
                    <p className="text-sm opacity-60">
                      Countries with requests
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Maps Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="card-title">Request Locations (Map)</h3>
                </div>
                <div className="h-96 rounded-lg overflow-hidden">
                  <MapComponent logs={logs} />
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-secondary" />
                  <h3 className="card-title">Request Locations (3D Globe)</h3>
                </div>
                <div className="h-96 rounded-lg overflow-hidden">
                  <GlobeComponent logs={logs} />
                </div>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-accent" />
                <h3 className="card-title">Recent Request Logs</h3>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <select
                  className="select select-bordered select-sm"
                  value={methodFilter}
                  onChange={(e) => {
                    setMethodFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">All Methods</option>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>

                <select
                  className="select select-bordered select-sm"
                  value={countryFilter}
                  onChange={(e) => {
                    setCountryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">All Countries</option>
                  {[...new Set(logs.map((log) => log.country).filter(Boolean))]
                    .sort()
                    .map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                </select>

                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="From Date"
                />

                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="To Date"
                />

                <input
                  type="text"
                  className="input input-bordered input-sm"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search path or IP..."
                />
              </div>

              {/* Results count */}
              <div className="text-sm text-base-content/70 mb-2">
                Showing {paginatedLogs.length} of {filteredLogs.length} logs
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="table table-zebra w-full">
                  <thead className="sticky top-0 bg-base-100">
                    <tr>
                      <th>Time</th>
                      <th>Method</th>
                      <th>Path</th>
                      <th>IP</th>
                      <th>Country</th>
                      <th>City</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.map((log) => (
                      <tr
                        key={log.id}
                        className={log.country ? "bg-base-200/50" : ""}
                      >
                        <td className="text-sm font-mono">
                          {new Date(log.time).toLocaleString()}
                        </td>
                        <td>
                          <div
                            className={`badge ${
                              log.method === "GET"
                                ? "badge-success"
                                : log.method === "POST"
                                ? "badge-primary"
                                : log.method === "PUT"
                                ? "badge-warning"
                                : log.method === "DELETE"
                                ? "badge-error"
                                : "badge-neutral"
                            }`}
                          >
                            {log.method}
                          </div>
                        </td>
                        <td className="font-mono text-sm max-w-xs truncate">
                          {log.path}
                        </td>
                        <td className="font-mono text-sm">{log.ip}</td>
                        <td>
                          {log.country && (
                            <div className="badge badge-info badge-sm">
                              {log.country}
                            </div>
                          )}
                        </td>
                        <td>{log.city}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
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

                    {/* Page numbers */}
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

export default Dashboard;
