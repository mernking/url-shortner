import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Moon, Sun } from "lucide-react";
import {
  BarChart3,
  TrendingUp,
  Globe,
  Clock,
  Users,
  Eye,
  MousePointer,
  Tag,
} from "lucide-react";
import Sidebar from "../components/Sidebar";

function Analytics({ onLogout }) {
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get("/admin/analytics", { headers });
      setAnalytics(response.data);
    } catch (err) {
      setError("Failed to fetch analytics data");
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
          <span className="text-lg">Loading Analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div data-theme={theme} className="min-h-screen bg-base-200 flex">
      <div className="flex-1 flex flex-col">
        {/* <div className="navbar bg-base-100 shadow-lg">
          <div className="navbar-start">
            <h1 className="text-2xl font-bold text-primary">
              Analytics Dashboard
            </h1>
          </div>
        </div> */}

        <div className="w-full p-6 space-y-6">
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {/* Time-based Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Stats */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="card-title">
                    Daily Request Trends (Last 7 Days)
                  </h3>
                </div>
                <div className="h-64 flex items-end justify-between gap-2">
                  {analytics.timeBasedAnalytics?.dailyStats?.map(
                    (day, index) => (
                      <div
                        key={index}
                        className="flex flex-col items-center flex-1"
                      >
                        <div
                          className="w-full bg-primary rounded-t"
                          style={{
                            height: `${Math.max(
                              (day.count /
                                Math.max(
                                  ...analytics.timeBasedAnalytics.dailyStats.map(
                                    (d) => d.count
                                  )
                                )) *
                                200,
                              20
                            )}px`,
                          }}
                        ></div>
                        <span className="text-xs mt-2 text-center">
                          {new Date(day.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="text-xs text-gray-500">
                          {day.count}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Hourly Stats */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-secondary" />
                  <h3 className="card-title">
                    Hourly Activity (Last 24 Hours)
                  </h3>
                </div>
                <div className="h-64 flex items-end justify-between gap-1">
                  {analytics.timeBasedAnalytics?.hourlyStats?.map(
                    (hour, index) => (
                      <div
                        key={index}
                        className="flex flex-col items-center"
                        style={{ width: "3%" }}
                      >
                        <div
                          className="w-full bg-secondary rounded-t"
                          style={{
                            height: `${Math.max(
                              (hour.count /
                                Math.max(
                                  ...analytics.timeBasedAnalytics.hourlyStats.map(
                                    (h) => h.count
                                  )
                                )) *
                                200,
                              20
                            )}px`,
                          }}
                        ></div>
                        <span className="text-xs mt-2 text-center transform -rotate-45 origin-center">
                          {hour.hour}:00
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Device and Browser Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Device Breakdown */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-2 mb-4">
                  <MousePointer className="w-5 h-5 text-accent" />
                  <h3 className="card-title">Device Types</h3>
                </div>
                <div className="space-y-2">
                  {Object.entries(
                    analytics.deviceBrowserAnalytics?.deviceBreakdown || {}
                  ).map(([device, count]) => (
                    <div
                      key={device}
                      className="flex justify-between items-center"
                    >
                      <span className="capitalize">{device}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-accent h-2 rounded-full"
                            style={{
                              width: `${
                                (count /
                                  Object.values(
                                    analytics.deviceBrowserAnalytics
                                      .deviceBreakdown
                                  ).reduce((a, b) => a + b, 0)) *
                                100
                              }%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Browser Breakdown */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-primary" />
                  <h3 className="card-title">Browsers</h3>
                </div>
                <div className="space-y-2">
                  {Object.entries(
                    analytics.deviceBrowserAnalytics?.browserBreakdown || {}
                  )
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([browser, count]) => (
                      <div
                        key={browser}
                        className="flex justify-between items-center"
                      >
                        <span>{browser}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{
                                width: `${
                                  (count /
                                    Object.values(
                                      analytics.deviceBrowserAnalytics
                                        .browserBreakdown
                                    ).reduce((a, b) => a + b, 0)) *
                                  100
                                }%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* OS Breakdown */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-secondary" />
                  <h3 className="card-title">Operating Systems</h3>
                </div>
                <div className="space-y-2">
                  {Object.entries(
                    analytics.deviceBrowserAnalytics?.osBreakdown || {}
                  )
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([os, count]) => (
                      <div
                        key={os}
                        className="flex justify-between items-center"
                      >
                        <span>{os}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-secondary h-2 rounded-full"
                              style={{
                                width: `${
                                  (count /
                                    Object.values(
                                      analytics.deviceBrowserAnalytics
                                        .osBreakdown
                                    ).reduce((a, b) => a + b, 0)) *
                                  100
                                }%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Referral Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Referral Categories */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="w-5 h-5 text-accent" />
                  <h3 className="card-title">Referral Categories</h3>
                </div>
                <div className="space-y-4">
                  {Object.entries(
                    analytics.referralAnalytics?.referralCategories || {}
                  ).map(([category, count]) => (
                    <div
                      key={category}
                      className="flex justify-between items-center"
                    >
                      <span className="capitalize">{category}</span>
                      <div className="flex items-center gap-4">
                        <div className="w-32 bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-accent h-3 rounded-full"
                            style={{
                              width: `${
                                (count /
                                  Object.values(
                                    analytics.referralAnalytics
                                      .referralCategories
                                  ).reduce((a, b) => a + b, 0)) *
                                100
                              }%`,
                            }}
                          ></div>
                        </div>
                        <span className="font-medium">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Referrers */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-primary" />
                  <h3 className="card-title">Top Referral Sources</h3>
                </div>
                <div className="space-y-2">
                  {analytics.referralAnalytics?.topReferrers
                    ?.slice(0, 10)
                    .map((referrer, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center"
                      >
                        <span className="truncate flex-1">
                          {referrer.domain}
                        </span>
                        <span className="badge badge-primary badge-sm ml-2">
                          {referrer.count}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top Links */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-5 h-5 text-secondary" />
                <h3 className="card-title">Top Performing Links</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Link</th>
                      <th>Destination</th>
                      <th>Clicks</th>
                      <th>Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topLinks?.map((link) => (
                      <tr key={link.slug}>
                        <td className="font-mono text-sm">{link.slug}</td>
                        <td className="max-w-xs truncate font-mono text-sm">
                          {link.destination}
                        </td>
                        <td>
                          <div className="badge badge-secondary badge-sm">
                            {link._count.clicks}
                          </div>
                        </td>
                        <td>{link.title || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
