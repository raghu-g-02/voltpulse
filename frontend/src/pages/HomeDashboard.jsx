// src/pages/HomeDashboard.jsx
import React from "react";
import Navbar from "../components/Navbar";
import { 
  Gauge, UserCheck, ShieldCheck, ArrowRight, Car, 
  CheckCircle2, AlertOctagon, Activity
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTelemetry } from "../context/TelemetryContext";

export default function HomeDashboard({ onOpenConsole, onOpenAbout }) {
  const { userProfile } = useAuth();
  const { agentResult } = useTelemetry();
  
  const faultClass = agentResult?.diagnosis?.fault_class ?? 0;
  const isSafe = faultClass === 0;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Navbar 
          currentView="home" 
          onNavigate={(view) => {
            if (view === "console" || view === "cockpit") onOpenConsole();
            if (view === "about") onOpenAbout();
          }} 
        />

        {/* 1. Welcome Banner */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 font-mono">
              Vehicle Telematics Portal
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-1">
              Welcome, {userProfile?.fullName || "Vehicle Owner"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Your {userProfile?.vehicleModel || "3S Hardware Testbench"} is connected and streaming telemetry.
            </p>
          </div>

          <button
            onClick={onOpenConsole}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/20 flex items-center gap-2"
          >
            <span>Launch Cockpit HUD</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Navigation Action Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tile 1: Cockpit HUD */}
          <div 
            onClick={onOpenConsole}
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer space-y-3 group"
          >
            <span className="p-3 rounded-xl bg-cyan-50 text-cyan-600 inline-block border border-cyan-100 group-hover:bg-cyan-100 transition">
              <Gauge className="w-6 h-6" />
            </span>
            <h3 className="text-base font-bold text-slate-900">Cockpit HUD & Telematics</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Open live telemetry meters, real-time dynamics, the AI voice co-pilot, and the comprehensive fault transition history.
            </p>
            <div className="pt-2 text-xs font-bold text-cyan-600 flex items-center gap-1">
              <span>Open Driving Cockpit →</span>
            </div>
          </div>

          {/* Tile 2: Vehicle Profile & Settings */}
          <div 
            onClick={onOpenAbout}
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer space-y-3 group"
          >
            <span className="p-3 rounded-xl bg-indigo-50 text-indigo-600 inline-block border border-indigo-100 group-hover:bg-indigo-100 transition">
              <UserCheck className="w-6 h-6" />
            </span>
            <h3 className="text-base font-bold text-slate-900">Vehicle Profile & Settings</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Review and edit your registered vehicle information, contact phone number, linked chassis number (VIN), and account credentials.
            </p>
            <div className="pt-2 text-xs font-bold text-indigo-600 flex items-center gap-1">
              <span>Manage Vehicle Details →</span>
            </div>
          </div>

          {/* Tile 3: Health Status */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
            <span className={`p-3 rounded-xl inline-block border ${
              isSafe 
                ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                : "bg-rose-50 text-rose-600 border-rose-100"
            }`}>
              {isSafe ? <ShieldCheck className="w-6 h-6" /> : <AlertOctagon className="w-6 h-6 animate-pulse" />}
            </span>
            
            <h3 className="text-base font-bold text-slate-900">Vehicle Health Status</h3>
            
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                isSafe 
                  ? "bg-emerald-100 text-emerald-800" 
                  : "bg-rose-100 text-rose-800"
              }`}>
                {isSafe ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertOctagon className="w-3.5 h-3.5" />}
                <span>{isSafe ? "Safe to Operate" : "Action Required"}</span>
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {isSafe 
                ? "All powertrain channels are operating within optimal safe thresholds." 
                : `Anomaly detected: ${agentResult?.diagnosis?.diagnosis_label || "Inspect powertrain in Cockpit HUD."}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}