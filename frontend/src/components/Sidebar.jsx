import React from "react";
import {
  Server,
  Users,
  Link as LinkIcon,
  BarChart3,
  Activity,
  Shield,
  Tag,
  LogOut,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

function Sidebar({ onLogout }) {
  const location = useLocation();

  const navigationItems = [
    {
      path: "/dashboard",
      label: "Dashboard",
      icon: Server,
    },
    {
      path: "/users",
      label: "Users",
      icon: Users,
    },
    {
      path: "/links",
      label: "Links",
      icon: LinkIcon,
    },
    {
      path: "/analytics",
      label: "Analytics",
      icon: BarChart3,
    },
    {
      path: "/activity-logs",
      label: "Activity Logs",
      icon: Activity,
    },
    {
      path: "/role-management",
      label: "Role Management",
      icon: Shield,
    },
    {
      path: "/tag-management",
      label: "Tag Management",
      icon: Tag,
    },
  ];

  return (
    <div className="bg-base-100 w-64 h-screen shadow-lg flex flex-col">
      <div className="p-6 border-b border-base-300">
        <div className="flex items-center gap-2">
          <Server className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-bold text-primary">Admin Panel</h1>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-primary text-primary-content"
                  : "hover:bg-base-200 text-base-content"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-base-300">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-4 py-3 btn btn-outline btn-error rounded-lg"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;