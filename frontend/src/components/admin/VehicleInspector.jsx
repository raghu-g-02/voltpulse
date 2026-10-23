// src/components/admin/VehicleInspector.jsx
import React, { useState } from "react";
import { 
  ArrowLeft, Download, CheckCircle2, AlertOctagon, Car, 
  User, ChevronDown, ChevronUp, Zap, Activity, Gauge, 
  Thermometer, Wind, Droplets, Clock, Filter, ArrowUpDown, 
  Trash2, ArrowUpRight, ArrowDownRight, Waves, Cpu
} from "lucide-react";

export default function VehicleInspector({
  vehicle,
  modelCalibration,
  liveTelemetry,
  faults,
  logs,
  loadingAuditData,
  onBack,
  onExportCSV,
  onPruneLogs,
  isCleaningLogs,
}) {
  const [showOwnerDetails, setShowOwnerDetails] = useState(false);
  const [auditTab, setAuditTab] = useState("fault_history");
  const [filterType, setFilterType] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("DESC");

  const vMin = parseFloat(modelCalibration?.voltage_min ?? modelCalibration?.voltage_sag_limit ?? 9.8);
  const vMax = parseFloat(modelCalibration?.voltage_max ?? 12.6);
  const iOver = parseFloat(modelCalibration?.current_max ?? modelCalibration?.current_overload_limit ?? 0.85);
  const tCrit = parseFloat(modelCalibration?.temp_max ?? modelCalibration?.temp_critical_limit ?? 38.0);
  const rpmMax = parseFloat(modelCalibration?.rpm_max ?? modelCalibration?.rpm_max_rated ?? 260);
  const vibMax = parseFloat(modelCalibration?.vibration_max ?? modelCalibration?.vibration_limit ?? 2.2);

  const curV = parseFloat(liveTelemetry?.Voltage ?? 0);
  const curI = parseFloat(liveTelemetry?.Current ?? 0);
  const curT = parseFloat(liveTelemetry?.Temperature ?? 0);
  const curRpm = Math.round(liveTelemetry?.motor_rpm ?? 0);
  const vibX = parseFloat(liveTelemetry?.vibration_x ?? 0.05);
  const vibY = parseFloat(liveTelemetry?.vibration_y ?? 0.08);
  const vibZ = parseFloat(liveTelemetry?.vibration_z ?? 9.81);
  const dynamicVib = Math.max(0.0, Math.abs(Math.sqrt(vibX**2 + vibY**2 + vibZ**2) - 9.81));

  const isVoltageLow = curV > 0.5 && (curV < vMin || curV > vMax);
  const isTempHigh = curT >= tCrit;
  const isOverload = curI >= iOver;
  const isVibHigh = dynamicVib >= vibMax;
  const isFaultActive = isVoltageLow || isTempHigh || isOverload || isVibHigh;

  const getInspectFaultTitle = () => {
    const activeWarnings = [];
    if (isTempHigh) activeWarnings.push("Thermal Overheat");
    if (isVoltageLow) activeWarnings.push(curV < vMin ? "Voltage Sag" : "Voltage Surge");
    if (isOverload) activeWarnings.push("Motor Overload");
    if (isVibHigh) activeWarnings.push("Severe Vibration");
    return activeWarnings.length > 1 ? `Multiple Faults: ${activeWarnings.join(" & ")}` : (activeWarnings[0] || "Anomaly Active");
  };

  let displayedFaults = [...faults];
  if (filterType === "INCREASES_ONLY") {
    displayedFaults = displayedFaults.filter((f) => f.eventType === "FAULT_INCEPTION" || f.eventType === "FAULT_ESCALATED");
  } else if (filterType === "DECREASES_ONLY") {
    displayedFaults = displayedFaults.filter((f) => f.eventType === "FAULT_DEESCALATED");
  } else if (filterType === "RECOVERIES_ONLY") {
    displayedFaults = displayedFaults.filter((f) => f.eventType === "RECOVERY_NORMAL");
  }
  displayedFaults.sort((a, b) => sortOrder === "ASC" ? a.timestampRaw - b.timestampRaw : b.timestampRaw - a.timestampRaw);

  let displayedLogs = [...logs];
  displayedLogs.sort((a, b) => sortOrder === "ASC" ? a.timestampRaw - b.timestampRaw : b.timestampRaw - a.timestampRaw);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Fleet Directory</span>
        </button>

        <button
          onClick={onExportCSV}
          className="px-3.5 py-1.5 rounded-xl border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-bold flex items-center gap-1.5 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit CSV</span>
        </button>
      </div>

      {/* Alert Banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
        !isFaultActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm"
          : "border-rose-300 bg-rose-50 text-rose-900 shadow-sm"
      }`}>
        <div className="flex items-center gap-3">
          {!isFaultActive ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertOctagon className="w-6 h-6 text-rose-600 flex-shrink-0 animate-bounce" />
          )}
          <div>
            <div className="text-sm font-bold">
              {!isFaultActive ? `Vehicle Status: SAFE (${modelCalibration?.modelName || vehicle.vehicleModel})` : `Powertrain Warning: ${getInspectFaultTitle()}`}
            </div>
            <div className="text-xs opacity-90 mt-0.5">
              {!isFaultActive
                ? `Operational limits: Voltage ${vMin}V–${vMax}V, Current < ${iOver}A, Temp < ${tCrit}°C.`
                : "Parameters breached the model's calibrated safety envelope."}
            </div>
          </div>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-bold ${
          !isFaultActive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
        }`}>
          {!isFaultActive ? "Nominal" : "Action Required"}
        </span>
      </div>

      {/* Model Spec & Owner Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Car className="w-5 h-5 text-cyan-600" />
              <span>{vehicle.vehicleModel || "Electric Vehicle"}</span>
              <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 rounded-full text-slate-600">
                {vehicle.vehicleId || "VEH-ID"}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              VIN: <strong className="font-mono text-cyan-700">{vehicle.chassisNumber}</strong> | 
              Model Limits: <strong className="text-emerald-700 font-semibold">{modelCalibration?.modelName || "Standard Envelope"}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowOwnerDetails(!showOwnerDetails)}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span>Owner Details</span>
            {showOwnerDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showOwnerDetails && (
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-slate-50/70 p-4 rounded-xl">
            <div className="p-3 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Owner Full Name</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">{vehicle.fullName || "—"}</span>
            </div>
            <div className="p-3 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contact Phone</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">{vehicle.phone || "—"}</span>
            </div>
            <div className="p-3 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Gmail Address</span>
              <span className="font-medium text-cyan-700 mt-0.5 block truncate">{vehicle.email || "—"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Sensor Gauges */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Live Telemetry Stream ({vehicle.chassisNumber})
            </h3>
            <p className="text-xs text-slate-400">Calibrated to model: {modelCalibration?.modelName || vehicle.vehicleModel}</p>
          </div>

          {liveTelemetry && liveTelemetry.Voltage > 0 ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Live Stream Active</span>
            </span>
          ) : (
            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full font-semibold">
              Vehicle Standby / Initializing
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
              <span>Battery Voltage</span>
              <Zap className="w-4 h-4 text-cyan-600" />
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-2">
              {curV.toFixed(2)} <span className="text-sm font-normal text-slate-500">V</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Safe: {vMin}V–{vMax}V</div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
              <span>Power Draw</span>
              <Activity className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-2">
              {curI.toFixed(2)} <span className="text-sm font-normal text-slate-500">A</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Overload: &ge; {iOver} A</div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
              <span>Motor Speed</span>
              <Gauge className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-2">
              {curRpm} <span className="text-sm font-normal text-slate-500">RPM</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Max: {rpmMax} RPM</div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
              <span>Battery Temperature</span>
              <Thermometer className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-2">
              {curT.toFixed(1)} <span className="text-sm font-normal text-slate-500">°C</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Thermal Cutoff: &ge; {tCrit} °C</div>
          </div>
        </div>
      </div>

      {/* Transitions & Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-3">
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              onClick={() => setAuditTab("fault_history")}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                auditTab === "fault_history" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
              <span>Fault Transitions ({faults.length})</span>
            </button>
            <button
              onClick={() => setAuditTab("telemetry_logs")}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                auditTab === "telemetry_logs" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>60s Logs ({logs.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {auditTab === "fault_history" ? (
              <div className="flex items-center gap-1 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="py-1 px-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700"
                >
                  <option value="ALL">All Transitions</option>
                  <option value="INCREASES_ONLY">Fault Increases / Inceptions</option>
                  <option value="DECREASES_ONLY">Fault Decreases Only</option>
                  <option value="RECOVERIES_ONLY">Safe Recoveries Only</option>
                </select>
              </div>
            ) : (
              <button
                onClick={() => onPruneLogs(365)}
                disabled={isCleaningLogs || logs.length === 0}
                className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs text-rose-700 font-bold flex items-center gap-1 transition disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3 text-rose-600" />
                <span>{isCleaningLogs ? "Pruning..." : "Prune Old Logs (>1 Year)"}</span>
              </button>
            )}

            <button
              onClick={() => setSortOrder(sortOrder === "DESC" ? "ASC" : "DESC")}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-slate-700 flex items-center gap-1 font-semibold"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>{sortOrder === "DESC" ? "Newest First" : "Oldest First"}</span>
            </button>
          </div>
        </div>

        {loadingAuditData ? (
          <div className="text-xs text-slate-400 py-8 text-center">Loading audit records...</div>
        ) : auditTab === "fault_history" ? (
          displayedFaults.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <span className="font-medium">No fault transitions recorded for this vehicle.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase font-mono text-slate-400 bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">State Transition</th>
                    <th className="py-2.5 px-3">Fault Changes & Subsystems</th>
                    <th className="py-2.5 px-3">Telemetry Snapshot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {displayedFaults.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 text-slate-600 font-sans">
                        <div className="font-medium text-slate-800">{rec.time}</div>
                        <div className="text-[10px] text-slate-400">{rec.date}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        {rec.eventType === "FAULT_INCEPTION" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                            <AlertOctagon className="w-3 h-3 text-rose-600" />
                            <span>FAULT TRIGGERED</span>
                          </span>
                        )}
                        {rec.eventType === "FAULT_ESCALATED" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3 text-rose-600" />
                            <span>ESCALATED</span>
                          </span>
                        )}
                        {rec.eventType === "FAULT_DEESCALATED" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                            <ArrowDownRight className="w-3 h-3 text-amber-600" />
                            <span>DE-ESCALATED</span>
                          </span>
                        )}
                        {rec.eventType === "RECOVERY_NORMAL" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>RECOVERED</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-semibold text-slate-900">{rec.label}</div>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600 font-mono">
                        V: {rec.voltage}V | I: {rec.current}A | RPM: {rec.rpm} | T: {rec.temp}°C
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          displayedLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No 60-second logs recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-[10px] uppercase text-slate-400 bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-3">Date & Time</th>
                    <th className="py-2 px-3">Voltage</th>
                    <th className="py-2 px-3">Current</th>
                    <th className="py-2 px-3">Speed</th>
                    <th className="py-2 px-3">Battery Temp</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {displayedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 text-slate-600 font-sans">{log.date} {log.time}</td>
                      <td className="py-2 px-3 text-cyan-700 font-bold">{log.voltage} V</td>
                      <td className="py-2 px-3 text-blue-700 font-bold">{log.current} A</td>
                      <td className="py-2 px-3 text-indigo-700 font-bold">{log.rpm} RPM</td>
                      <td className="py-2 px-3 text-amber-700 font-bold">{log.temperature} °C</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.faultClass === 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}