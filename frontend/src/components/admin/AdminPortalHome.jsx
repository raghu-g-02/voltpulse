// src/components/admin/AdminPortalHome.jsx
import React from "react";
import { Factory, Layers, Users, Eye, Sliders } from "lucide-react";

export default function AdminPortalHome({ onNavigateSubView, totalVehicles, totalModels, onOpenAbout }) {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 font-mono">
            Manufacturer Operations Console
          </span>
          <h2 className="text-2xl font-black text-slate-900 mt-1">
            Fleet Administration & Model Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure vehicle models, calibrate operational threshold envelopes, and monitor active fleet nodes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateSubView("models")}
            className="px-4 py-2.5 rounded-xl border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Sliders className="w-4 h-4 text-cyan-600" />
            <span>Manage Models ({totalModels})</span>
          </button>

          <button
            onClick={() => onNavigateSubView("fleet")}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/20 flex items-center gap-1.5"
          >
            <span>Fleet Directory</span>
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div 
          onClick={() => onNavigateSubView("models")}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer space-y-3"
        >
          <span className="p-3 rounded-xl bg-cyan-50 text-cyan-600 inline-block border border-cyan-100">
            <Sliders className="w-6 h-6" />
          </span>
          <h3 className="text-base font-bold text-slate-900">Vehicle Models Catalog</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Create and edit vehicle models with custom voltage, current, temperature, and speed safety limits.
          </p>
          <div className="pt-2 text-xs font-bold text-cyan-600 flex items-center gap-1">
            <span>Manage {totalModels} Model Variant{totalModels === 1 ? "" : "s"} →</span>
          </div>
        </div>

        <div 
          onClick={() => onNavigateSubView("fleet")}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer space-y-3"
        >
          <span className="p-3 rounded-xl bg-emerald-50 text-emerald-600 inline-block border border-emerald-100">
            <Factory className="w-6 h-6" />
          </span>
          <h3 className="text-base font-bold text-slate-900">Enrolled Fleet Vehicles</h3>
          <div className="text-2xl font-black font-mono text-slate-900">
            {totalVehicles} <span className="text-xs font-normal text-slate-400">Active Chassis</span>
          </div>
          <p className="text-xs text-slate-500">
            Search chassis VINs, inspect live telemetry streams, and view fault transition histories.
          </p>
          <div className="pt-2 text-xs font-bold text-emerald-600 flex items-center gap-1">
            <span>Open Fleet Directory →</span>
          </div>
        </div>

        <div 
          onClick={onOpenAbout}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer space-y-3"
        >
          <span className="p-3 rounded-xl bg-rose-50 text-rose-600 inline-block border border-rose-100">
            <Layers className="w-6 h-6" />
          </span>
          <h3 className="text-base font-bold text-slate-900">System Architecture</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Review normalized 0-to-1 stress parameters, ASIL safety tiers, and automated dispatch logic.
          </p>
          <div className="pt-2 text-xs font-bold text-rose-600 flex items-center gap-1">
            <span>Review Architecture →</span>
          </div>
        </div>
      </div>
    </div>
  );
}