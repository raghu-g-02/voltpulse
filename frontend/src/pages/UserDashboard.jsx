// src/pages/UserDashboard.jsx
import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import EditProfileModal from "../components/EditProfileModal";
import { useAuth } from "../context/AuthContext";
import { useTelemetry } from "../context/TelemetryContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { 
  Zap, Activity, Gauge, Thermometer, Wind, Droplets, 
  AlertOctagon, CheckCircle2, Volume2, VolumeX, 
  Edit3, ShieldCheck, Cpu, Waves, Play, RotateCcw,
  Clock, Download, Filter, ArrowUpDown, ArrowUpRight, ArrowDownRight, ArrowLeft,
  Timer, Compass, Shield
} from "lucide-react";

export default function UserDashboard({ onBackToHome, onOpenAbout }) {
  const { userProfile } = useAuth();
  const { 
    telemetry, 
    agentResult, 
    source, 
    isVoiceMuted, 
    toggleVoiceMute,
    triggerSimulation,
    resetSimulation,
    isSimulating,
    simulationCountdown,
    faultHistory,
    telemetryLogs
  } = useTelemetry();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("cockpit");
  const [auditTab, setAuditTab] = useState("fault_history");
  const [filterType, setFilterType] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("DESC");

  // Dynamic live sync with Admin-configured vehicle_models collection
  const [liveModelCal, setLiveModelCal] = useState(null);

  useEffect(() => {
    const modelName = userProfile?.vehicleModel || "Nexon EV";
    const docId = modelName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const unsub = onSnapshot(doc(db, "vehicle_models", docId), (docSnap) => {
      if (docSnap.exists()) {
        setLiveModelCal(docSnap.data());
      }
    }, (err) => console.warn("Live model listener fallback:", err));

    return () => unsub();
  }, [userProfile?.vehicleModel]);

  // Read active thresholds set by Admin
  const appliedThresh = agentResult?.applied_thresholds || {};
  const activeCal = liveModelCal || userProfile?.calibration || {};

  const vMin = appliedThresh.voltage_min ?? activeCal.voltage_min ?? activeCal.voltage_sag_limit ?? 9.8;
  const vMax = appliedThresh.voltage_max ?? activeCal.voltage_max ?? 12.6;
  const iMax = appliedThresh.current_max ?? activeCal.current_max ?? activeCal.current_overload_limit ?? 0.85;
  const tMax = appliedThresh.temp_max ?? activeCal.temp_max ?? activeCal.temp_critical_limit ?? 38.0;
  const rpmMax = appliedThresh.rpm_max ?? activeCal.rpm_max ?? activeCal.rpm_max_rated ?? 260;
  const vibMax = appliedThresh.vibration_max ?? activeCal.vibration_max ?? 2.2;
  const modelTitle = activeCal.modelName || userProfile?.vehicleModel || "Nexon EV";

  const v = parseFloat(telemetry?.Voltage ?? 0);
  const i = parseFloat(telemetry?.Current ?? 0);
  const t = parseFloat(telemetry?.Temperature ?? 0);
  const rpm = Math.round(telemetry?.motor_rpm ?? 0);
  const amb_t = parseFloat(telemetry?.ambient_temp ?? 25.0);
  const amb_h = parseFloat(telemetry?.ambient_humidity ?? 50.0);
  const vib_x = parseFloat(telemetry?.vibration_x ?? 0.05);
  const vib_y = parseFloat(telemetry?.vibration_y ?? 0.08);
  const vib_z = parseFloat(telemetry?.vibration_z ?? 9.81);

  const diagnosis = agentResult?.diagnosis;
  const isFaultActive = diagnosis?.fault_class !== 0 && diagnosis?.fault_class !== undefined;
  const faultLabel = diagnosis?.diagnosis_label || "Nominal Operation";
  const driverSuggestion = diagnosis?.driver_suggestion || "Powertrain operating nominally within calibrated limits. Safe and fine to drive.";

  // Parameter breach flags
  const isVBreached = (v < vMin || v > vMax) && v > 0.2;
  const isIBreached = i >= iMax;
  const isTBreached = t >= tMax;

  // Filter & Sort Fault History
  let displayedFaults = [...faultHistory];
  if (filterType === "INCREASES_ONLY") {
    displayedFaults = displayedFaults.filter((f) => f.eventType === "FAULT_INCEPTION" || f.eventType === "FAULT_ESCALATED");
  } else if (filterType === "DECREASES_ONLY") {
    displayedFaults = displayedFaults.filter((f) => f.eventType === "FAULT_DEESCALATED");
  } else if (filterType === "RECOVERIES_ONLY") {
    displayedFaults = displayedFaults.filter((f) => f.eventType === "RECOVERY_NORMAL");
  }
  displayedFaults.sort((a, b) => sortOrder === "ASC" ? a.timestampRaw - b.timestampRaw : b.timestampRaw - a.timestampRaw);

  let displayedLogs = [...telemetryLogs];
  displayedLogs.sort((a, b) => sortOrder === "ASC" ? a.timestampRaw - b.timestampRaw : b.timestampRaw - a.timestampRaw);

  const exportCSV = () => {
    const chassis = userProfile?.chassisNumber || "MAT612089N1A23456";
    const headers = "Timestamp,Date,Time,Chassis,EventType,Label,Voltage_V,Current_A,Temp_C,RPM\n";
    const rows = displayedFaults.map((f) =>
      `${f.timestampRaw},${f.date},${f.time},${f.chassis || chassis},${f.eventType},"${(f.label || "").replace(/"/g, '""')}",${f.voltage},${f.current},${f.temp},${f.rpm}`
    ).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_${chassis}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <Navbar 
          currentView={activeTab} 
          onNavigate={(view) => {
            if (view === "about") onOpenAbout();
            else if (view === "home" && onBackToHome) onBackToHome();
            else setActiveTab(view);
          }} 
        />

        {/* Live Status Header */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 font-mono">
                {modelTitle}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                VIN: {userProfile?.chassisNumber || "MAT612089N1A23456"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>OEM Calibrated</span>
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1">Vehicle Telematics Cockpit</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Live Stream: <strong className="font-mono text-cyan-700">{source || "STANDBY"}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onBackToHome && (
              <button
                onClick={onBackToHome}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Portal Home</span>
              </button>
            )}

            <button
              onClick={toggleVoiceMute}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                isVoiceMuted 
                  ? "bg-slate-50 border-slate-200 text-slate-500" 
                  : "bg-cyan-50 border-cyan-200 text-cyan-700"
              }`}
            >
              {isVoiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isVoiceMuted ? "Voice Muted" : "Voice Active"}</span>
            </button>

            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Vehicle / Profile</span>
            </button>
          </div>
        </div>

        {/* Real-time Status Alert & Driver Suggestion Banner */}
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
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
              <div className="text-sm font-bold flex items-center gap-2">
                <span>{!isFaultActive ? `Status: SAFE (${modelTitle})` : `Safety Hazard: ${faultLabel}`}</span>
                {!isFaultActive && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Safe to Drive
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold opacity-90 mt-0.5 flex items-center gap-1 text-slate-700">
                <Compass className="w-3.5 h-3.5 text-cyan-700 flex-shrink-0" />
                <span>Recommendation: {driverSuggestion}</span>
              </div>
            </div>
          </div>
          
          <span className={`text-xs px-3 py-1 rounded-full font-bold flex-shrink-0 ${
            !isFaultActive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
          }`}>
            {!isFaultActive ? "Nominal Safe" : "Action Required"}
          </span>
        </div>

        {/* Interactive 10-Second Demo Simulation Controls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-cyan-600" />
                <span>Hardware Testbench Simulation Controls (10-Second Auto-Reset)</span>
              </span>
              <span className="text-slate-400 text-[11px]">
                Injects test fault states to verify OEM limits. Automatically reverts to live Firebase RTDB after 10s.
              </span>
            </div>

            {isSimulating && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs animate-pulse">
                <Timer className="w-4 h-4 text-amber-600" />
                <span>Demo Override: {simulationCountdown}s remaining</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <button
              onClick={() => triggerSimulation(1)}
              className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 text-rose-600" />
              <span>Breach Current Limit (&gt; {iMax}A)</span>
            </button>

            <button
              onClick={() => triggerSimulation(2)}
              className="px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 text-amber-600" />
              <span>Breach Voltage Min (&lt; {vMin}V)</span>
            </button>

            <button
              onClick={() => triggerSimulation(3)}
              className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 text-rose-600" />
              <span>Breach Temp Max (&gt; {tMax}°C)</span>
            </button>

            <button
              onClick={() => triggerSimulation(4)}
              className="px-3 py-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 text-purple-600" />
              <span>Breach Vibration (&gt; {vibMax} m/s²)</span>
            </button>

            <button
              onClick={resetSimulation}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold transition flex items-center gap-1.5 shadow-sm ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Reset to Live Firebase RTDB</span>
            </button>
          </div>
        </div>

        {/* 10-Channel Live Sensor Readings vs. OEM Envelopes */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Live Sensor Telemetry vs. OEM Thresholds
              </h2>
              <p className="text-xs text-slate-400">Values outside your model's safe range turn red automatically</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{isSimulating ? `Demo Override (${simulationCountdown}s)` : "Live RTDB Stream"}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {/* Voltage */}
            <div className={`rounded-2xl p-4 border transition ${
              isVBreached ? "bg-rose-50 border-rose-300" : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>Pack Voltage</span>
                <Zap className={`w-4 h-4 ${isVBreached ? "text-rose-600" : "text-cyan-600"}`} />
              </div>
              <div className={`text-2xl font-black font-mono mt-2 ${isVBreached ? "text-rose-700" : "text-slate-900"}`}>
                {v.toFixed(2)} <span className="text-sm font-normal text-slate-500">V</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-500 mt-1">
                Safe: <strong className="text-slate-800">{vMin}V – {vMax}V</strong>
              </div>
            </div>

            {/* Current */}
            <div className={`rounded-2xl p-4 border transition ${
              isIBreached ? "bg-rose-50 border-rose-300" : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>Motor Current</span>
                <Activity className={`w-4 h-4 ${isIBreached ? "text-rose-600" : "text-blue-600"}`} />
              </div>
              <div className={`text-2xl font-black font-mono mt-2 ${isIBreached ? "text-rose-700" : "text-slate-900"}`}>
                {i.toFixed(2)} <span className="text-sm font-normal text-slate-500">A</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-500 mt-1">
                Cutoff: <strong className="text-slate-800">≥ {iMax} A</strong>
              </div>
            </div>

            {/* RPM */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>LM393 Tachometer</span>
                <Gauge className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                {rpm} <span className="text-sm font-normal text-slate-500">RPM</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-500 mt-1">
                Rated Max: <strong className="text-slate-800">{rpmMax} RPM</strong>
              </div>
            </div>

            {/* Core Temp */}
            <div className={`rounded-2xl p-4 border transition ${
              isTBreached ? "bg-rose-50 border-rose-300" : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>DS18B20 Temp Probe</span>
                <Thermometer className={`w-4 h-4 ${isTBreached ? "text-rose-600" : "text-amber-600"}`} />
              </div>
              <div className={`text-2xl font-black font-mono mt-2 ${isTBreached ? "text-rose-700" : "text-slate-900"}`}>
                {t.toFixed(1)} <span className="text-sm font-normal text-slate-500">°C</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-500 mt-1">
                Thermal Cutoff: <strong className="text-slate-800">≥ {tMax} °C</strong>
              </div>
            </div>

            {/* Ambient Temp */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>DHT22 Room Temp</span>
                <Wind className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                {amb_t.toFixed(1)} <span className="text-sm font-normal text-slate-500">°C</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Ambient Weather</div>
            </div>

            {/* Ambient Humidity */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>DHT22 Humidity</span>
                <Droplets className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                {amb_h.toFixed(0)} <span className="text-sm font-normal text-slate-500">%</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Relative Moisture</div>
            </div>

            {/* Dynamic Vibration */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>Dynamic Vibration</span>
                <Waves className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                {(Math.max(0.0, Math.abs(Math.sqrt(vib_x**2 + vib_y**2 + vib_z**2) - 9.81))).toFixed(2)} <span className="text-sm font-normal text-slate-500">m/s²</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-500 mt-1">
                Limit: <strong className="text-slate-800">≤ {vibMax} m/s²</strong>
              </div>
            </div>

            {/* Z Gravity */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>MPU-6050 Z-Axis</span>
                <Cpu className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                {vib_z.toFixed(2)} <span className="text-sm font-normal text-slate-500">m/s²</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Earth Baseline: ~9.81 m/s²</div>
            </div>
          </div>
        </div>

        {/* History & 60s Logs Section */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-3">
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
              <button
                onClick={() => setAuditTab("fault_history")}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  auditTab === "fault_history" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                <span>Fault Transitions ({faultHistory.length})</span>
              </button>
              <button
                onClick={() => setAuditTab("telemetry_logs")}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  auditTab === "telemetry_logs" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>60s Telemetry Logs ({telemetryLogs.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {auditTab === "fault_history" && (
                <div className="flex items-center gap-1 text-xs">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="py-1 px-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700"
                  >
                    <option value="ALL">All Events</option>
                    <option value="INCREASES_ONLY">Fault Triggers</option>
                    <option value="DECREASES_ONLY">Fault Cleared</option>
                    <option value="RECOVERIES_ONLY">Safe Recoveries</option>
                  </select>
                </div>
              )}

              <button
                onClick={() => setSortOrder(sortOrder === "DESC" ? "ASC" : "DESC")}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-slate-700 flex items-center gap-1 font-semibold"
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>{sortOrder === "DESC" ? "Newest First" : "Oldest First"}</span>
              </button>

              <button
                onClick={exportCSV}
                className="px-2.5 py-1 rounded-lg border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-xs text-cyan-700 font-bold flex items-center gap-1 transition"
              >
                <Download className="w-3 h-3" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {auditTab === "fault_history" ? (
            displayedFaults.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <span className="font-medium">No recorded faults on this vehicle. Safe operations log.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase font-mono text-slate-400 bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">State Event</th>
                      <th className="py-2.5 px-3">Fault Details</th>
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
              <div className="py-8 text-center text-xs text-slate-400">No 60-second logs accumulated yet.</div>
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

        {/* OEM Linked Envelope Card (Read-Only to Drivers) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                <span>OEM Powertrain Specifications & Safe Envelope</span>
              </h2>
              <p className="text-xs text-slate-400">Calibrated by manufacturer engineer — applied to all {modelTitle} vehicles</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Safe Voltage Range</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{vMin} V – {vMax} V</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Overload Cutoff</span>
              <span className="font-mono font-bold text-rose-700 text-sm mt-0.5 block">≥ {iMax} A</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Thermal Cutoff</span>
              <span className="font-mono font-bold text-amber-700 text-sm mt-0.5 block">≥ {tMax} °C</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Vibration Limit</span>
              <span className="font-mono font-bold text-purple-700 text-sm mt-0.5 block">≤ {vibMax} m/s²</span>
            </div>
          </div>
        </div>
      </div>

      <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
    </div>
  );
}