import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import LinkManagement from "./pages/LinkManagement.jsx";
import UserManagement from "./pages/UserManagement.jsx";
import Analytics from "./pages/Analytics.jsx";
import { Activity } from "lucide-react";
import io from "socket.io-client";
import ActivityLogs from "./pages/ActivityLogs.jsx";
import RoleManagement from "./pages/RoleManagement.jsx";
import TagManagement from "./pages/TagManagement.jsx";
import Error from "./pages/Error.jsx";
import AdminLayout from "./components/layout/AdminLayout.jsx";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem("adminToken", token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setIsAuthenticated(false);
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
    <div className="min-h-screen bg-base-200">
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <AdminLayout page={<Dashboard onLogout={handleLogout} />} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/links"
          element={
            isAuthenticated ? (
              <AdminLayout page={<LinkManagement onLogout={handleLogout} />} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/activity-logs"
          element={
            isAuthenticated ? (
              <AdminLayout page={<ActivityLogs onLogout={handleLogout} />} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/role-management"
          element={
            isAuthenticated ? (
              <AdminLayout page={<RoleManagement onLogout={handleLogout} />} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/tag-management"
          element={
            isAuthenticated ? (
              <AdminLayout page={<TagManagement onLogout={handleLogout} />} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/users"
          element={
            isAuthenticated ? (
              <AdminLayout page={<UserManagement onLogout={handleLogout} />} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/analytics"
          element={
            isAuthenticated ? (
              <AdminLayout page={<Analytics onLogout={handleLogout} />} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/"
          element={
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          }
        />
        <Route path="*" element={<Error />} />
      </Routes>
    </div>
  );
}

export default App;
