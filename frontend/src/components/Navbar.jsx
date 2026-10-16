// In src/components/Navbar.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import EditProfileModal from "./EditProfileModal";
import { LogOut, User, Zap, Settings } from "lucide-react";

export default function Navbar({ currentView, onNavigate }) {
  const { userProfile, userRole, logout } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const isAdmin = userRole === "admin";

  return (
    <>
      <header className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between font-sans">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="font-black text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
              <span>VoltPulse AI</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-bold uppercase">
                {isAdmin ? "OEM Console" : "Driver Cockpit"}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {isAdmin ? userProfile?.companyName || "Automotive Manufacturer" : `${userProfile?.vehicleModel || "EV"} (${userProfile?.chassisNumber || "VIN"})`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isAdmin && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Change Car Model or Update Profile"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Edit Vehicle</span>
            </button>
          )}

          <button
            onClick={logout}
            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Profile & Model Update Modal */}
      <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
    </>
  );
}