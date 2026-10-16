// src/components/Navbar.jsx
import React from "react";
import { Zap, LogOut, Home, LayoutDashboard, UserCheck, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTelemetry } from "../context/TelemetryContext";

export default function Navbar({ currentView, onNavigate }) {
  const { userRole, logout } = useAuth();
  const context = useTelemetry() || {};
  const { source = "STANDBY", isVoiceMuted = true, toggleVoiceMute = () => {} } = context;
  const isAdmin = userRole === "admin";

  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-5 border-b border-slate-200 gap-4">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <span className="p-2.5 rounded-2xl bg-cyan-600 text-white shadow-md shadow-cyan-600/20">
          <Zap className="w-5 h-5" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-900">VoltPulse AI</h1>
            <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border font-bold ${
              isAdmin
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-cyan-50 border-cyan-200 text-cyan-700"
            }`}>
              {isAdmin ? "Manufacturer Console" : "Vehicle Owner"}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {isAdmin 
              ? "Autonomous Fleet Management Platform" 
              : "Autonomous EV Powertrain Telematics Platform"}
          </p>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {onNavigate && (
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
            {isAdmin ? (
              <>
                <button
                  onClick={() => onNavigate("home")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    currentView === "home" ? "bg-slate-100 text-cyan-700 font-bold" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Overview</span>
                </button>
                <button
                  onClick={() => onNavigate("fleet")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    currentView === "fleet" || currentView === "inspect" ? "bg-slate-100 text-cyan-700 font-bold" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Fleet Directory</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onNavigate("home")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    currentView === "home" ? "bg-slate-100 text-cyan-700 font-bold" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Overview</span>
                </button>
                <button
                  onClick={() => onNavigate("console")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    currentView === "console" ? "bg-slate-100 text-cyan-700 font-bold" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Cockpit HUD</span>
                </button>
              </>
            )}

            <button
              onClick={() => onNavigate("about")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                currentView === "about" ? "bg-slate-100 text-cyan-700 font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isAdmin ? "Org Profile" : "Vehicle Profile"}</span>
            </button>
          </div>
        )}

        {/* Audio Mute Controller: Available ONLY for vehicle drivers */}
        {!isAdmin && (
          <button
            onClick={toggleVoiceMute}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              !isVoiceMuted
                ? "bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100"
                : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
            }`}
            title={isVoiceMuted ? "Click to Unmute Co-Pilot Voice" : "Click to Mute Co-Pilot Voice"}
          >
            {!isVoiceMuted ? <Volume2 className="w-4 h-4 text-cyan-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span>{!isVoiceMuted ? "Voice Active" : "Muted"}</span>
          </button>
        )}

        {/* Connection Status */}
        <div className="px-3 py-1.5 rounded-xl text-xs font-mono border border-slate-200 bg-white text-slate-600 flex items-center gap-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{isAdmin ? "FLEET_MONITOR" : source}</span>
        </div>

        {/* Sign Out */}
        <button
          onClick={logout}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-600 text-xs flex items-center gap-1.5 transition shadow-sm"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline font-semibold">Logout</span>
        </button>
      </div>
    </header>
  );
}