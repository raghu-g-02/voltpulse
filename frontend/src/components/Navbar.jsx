// src/components/Navbar.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import EditProfileModal from "./EditProfileModal";
import { 
  Zap, 
  LogOut, 
  LayoutDashboard, 
  Users, 
  Sliders, 
  Info, 
  Settings, 
  Activity 
} from "lucide-react";

export default function Navbar({ currentView = "home", onNavigate = () => {} }) {
  const { userProfile, userRole, logout } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const isAdmin = userRole === "admin";

  return (
    <>
      <header className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 font-sans">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div 
            onClick={() => onNavigate(isAdmin ? "home" : "cockpit")}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 flex-shrink-0">
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
                {isAdmin 
                  ? (userProfile?.companyName || "Automotive Manufacturer") 
                  : `${userProfile?.vehicleModel || "EV"} (${userProfile?.chassisNumber || "VIN"})`}
              </div>
            </div>
          </div>

          {/* Mobile Logout (visible on small screens) */}
          <button
            onClick={logout}
            className="md:hidden p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Center Navigation Buttons */}
        <nav className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs font-semibold overflow-x-auto w-full md:w-auto justify-center">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate("home")}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  currentView === "home"
                    ? "bg-white text-cyan-700 shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("fleet")}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  currentView === "fleet" || currentView === "inspect"
                    ? "bg-white text-cyan-700 shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Fleet Directory</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("models")}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  currentView === "models"
                    ? "bg-white text-cyan-700 shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Vehicle Models</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("about")}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  currentView === "about"
                    ? "bg-white text-cyan-700 shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Architecture</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onNavigate("cockpit")}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  currentView === "cockpit"
                    ? "bg-white text-cyan-700 shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Live Cockpit</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("about")}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  currentView === "about"
                    ? "bg-white text-cyan-700 shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>System Info</span>
              </button>
            </>
          )}
        </nav>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-2">
          {!isAdmin && (
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              title="Change Car Model or Update Profile"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Vehicle</span>
            </button>
          )}

          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Profile & Model Update Modal */}
      <EditProfileModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
      />
    </>
  );
}