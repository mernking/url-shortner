import React from "react";
import Sidebar from "../Sidebar";

export default function AdminLayout({ page }) {
  return (
    <div className="min-h-screen bg-base-200 flex">
      <div className="w-fit fixed top-0 left-0 h-full">
        <Sidebar />
      </div>
      <div className="p-2 w-full ml-64">{page}</div>
    </div>
  );
}
