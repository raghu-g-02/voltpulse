// src/components/admin/FleetDirectory.jsx
import React from "react";
import { Factory, Search, RefreshCw, Eye, X } from "lucide-react";

export default function FleetDirectory({
  fleetUsers,
  loadingUsers,
  searchInput,
  setSearchInput,
  activeFilterQuery,
  onSearchSubmit,
  onClearSearch,
  onRefresh,
  onInspectVehicle,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-100 gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Factory className="w-4 h-4 text-cyan-600" />
            Enrolled Fleet Vehicles Directory
          </h2>
          <p className="text-xs text-slate-500">
            Search by Gmail, Chassis VIN, Phone, or Model variant.
          </p>
        </div>

        <form onSubmit={onSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Gmail, Chassis VIN, Phone, Model..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          {activeFilterQuery && (
            <button
              type="button"
              onClick={onClearSearch}
              className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition"
              title="Clear Filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
            title="Refresh Fleet"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </form>
      </div>

      {activeFilterQuery && (
        <div className="text-xs text-cyan-800 bg-cyan-50 border border-cyan-200 px-3 py-1.5 rounded-xl flex items-center justify-between">
          <span>
            Showing search results for: <strong>"{activeFilterQuery}"</strong> ({fleetUsers.length} matching vehicles)
          </span>
          <button onClick={onClearSearch} className="text-cyan-700 underline font-semibold ml-2">
            Show All
          </button>
        </div>
      )}

      {loadingUsers ? (
        <div className="text-xs text-slate-400 py-8 text-center">Loading fleet registry...</div>
      ) : fleetUsers.length === 0 ? (
        <div className="text-xs text-slate-400 py-8 text-center">
          No vehicle owners matched your search criteria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase font-mono text-slate-400 bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-3">Vehicle Owner</th>
                <th className="py-2.5 px-3">Email Address</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Vehicle Model</th>
                <th className="py-2.5 px-3">Chassis Number (VIN)</th>
                <th className="py-2.5 px-3 text-right">Inspect Telemetry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {fleetUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                    {u.fullName || "Owner"}
                  </td>
                  <td className="py-2.5 px-3 text-cyan-700 font-medium">{u.email}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-600">{u.phone || "—"}</td>
                  <td className="py-2.5 px-3 font-sans">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                      {u.vehicleModel || "Demo Testbench"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{u.chassisNumber || "—"}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onInspectVehicle(u)}
                      className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 ml-auto shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}