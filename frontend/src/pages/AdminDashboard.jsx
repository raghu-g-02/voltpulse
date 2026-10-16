// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import { 
  Factory, Activity, Download, Search, RefreshCw, Eye, 
  ArrowLeft, CheckCircle2, AlertOctagon, Car, 
  Clock, Filter, ArrowUpDown, Zap, Gauge, Thermometer, 
  Wind, Droplets, Users, X, User, ChevronDown, ChevronUp, Layers, 
  ArrowUpRight, ArrowDownRight, Trash2
} from "lucide-react";
import { collection, getDocs, query, orderBy, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

const API_BASE = "http://localhost:8000";

export default function AdminDashboard({ onBackToHome, onOpenAbout, initialSubView = "home" }) {
  const [adminSubView, setAdminSubView] = useState(initialSubView);

  const [fleetUsers, setFleetUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Search input state
  const [searchInput, setSearchInput] = useState("");
  const [activeFilterQuery, setActiveFilterQuery] = useState("");

  // Inspect state
  const [inspectedVehicle, setInspectedVehicle] = useState(null);
  const [showOwnerDetails, setShowOwnerDetails] = useState(false);
  const [liveVehicleTelemetry, setLiveVehicleTelemetry] = useState(null);
  const [inspectedFaults, setInspectedFaults] = useState([]);
  const [inspectedLogs, setInspectedLogs] = useState([]);
  const [loadingAuditData, setLoadingAuditData] = useState(false);
  const [isCleaningStaleLogs, setIsCleaningStaleLogs] = useState(false);

  // Inspector tabs and controls
  const [auditTab, setAuditTab] = useState("fault_history");
  const [filterType, setFilterType] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("DESC");

  const latestLiveTelemetryRef = useRef(liveVehicleTelemetry);
  useEffect(() => {
    latestLiveTelemetryRef.current = liveVehicleTelemetry;
  }, [liveVehicleTelemetry]);

  const fetchFleet = async () => {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const list = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setFleetUsers(list);
    } catch (err) {
      console.error("Failed to load fleet registry:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  // Poll live telemetry ONLY when inspecting a vehicle
  useEffect(() => {
    if (!inspectedVehicle?.chassisNumber) {
      setLiveVehicleTelemetry(null);
      return;
    }

    const pollLive = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/telemetry/${inspectedVehicle.chassisNumber}`);
        const data = await res.json();
        if (data.telemetry) {
          setLiveVehicleTelemetry(data.telemetry);
        }
      } catch (e) {
        console.error("Error polling vehicle live telemetry:", e);
      }
    };

    pollLive();
    const interval = setInterval(pollLive, 2000);
    return () => clearInterval(interval);
  }, [inspectedVehicle]);

  // Real-time Firestore sync for inspected vehicle
  useEffect(() => {
    if (!inspectedVehicle) return;

    setLoadingAuditData(true);

    const faultQ = query(collection(db, "users", inspectedVehicle.id, "fault_history"), orderBy("timestampRaw", "desc"));
    const unsubFaults = onSnapshot(faultQ, (snapshot) => {
      const fRecords = [];
      snapshot.forEach((doc) => fRecords.push({ id: doc.id, ...doc.data() }));
      setInspectedFaults(fRecords);
      setLoadingAuditData(false);
    }, (err) => {
      console.error("Error listening to inspected vehicle faults:", err);
      setLoadingAuditData(false);
    });

    const logQ = query(collection(db, "users", inspectedVehicle.id, "telemetry_logs"), orderBy("timestampRaw", "desc"));
    const unsubLogs = onSnapshot(logQ, (snapshot) => {
      const lRecords = [];
      snapshot.forEach((doc) => lRecords.push({ id: doc.id, ...doc.data() }));
      setInspectedLogs(lRecords);
    }, (err) => {
      console.error("Error listening to inspected vehicle logs:", err);
    });

    return () => {
      unsubFaults();
      unsubLogs();
    };
  }, [inspectedVehicle]);

  // CONTINUOUS 60-SECOND LOGGER DURING ADMIN INSPECTION (1-Minute Sustained Interval)
  useEffect(() => {
    if (!inspectedVehicle?.id) return;

    const timer = setInterval(() => {
      const tel = latestLiveTelemetryRef.current;
      if (!tel) return;

      const v = parseFloat(tel.Voltage ?? 0);
      const temp = parseFloat(tel.Temperature ?? 0);
      if (v <= 0.5 && temp <= 1.0) return;

      if (inspectedLogs.length > 0 && (Date.now() - inspectedLogs[0].timestampRaw < 50000)) {
        return;
      }

      const now = new Date();
      const isVoltageLow = v > 0.5 && v < 3.0;
      const isTempHigh = temp >= 60.0;
      const isCurrentHigh = parseFloat(tel.Current ?? 0) >= 2.5;

      let status = "Normal Operation";
      let faultClass = 0;
      if (isTempHigh) { status = "Critical Battery Overheat"; faultClass = 3; }
      else if (isVoltageLow) { status = "Inverter Voltage Sag"; faultClass = 2; }
      else if (isCurrentHigh) { status = "Motor Transmission Overload"; faultClass = 1; }

      const logRecord = {
        timestampRaw: Date.now(),
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        chassis: inspectedVehicle.chassisNumber,
        voltage: v.toFixed(2),
        current: parseFloat(tel.Current ?? 0).toFixed(2),
        temperature: temp.toFixed(1),
        rpm: Math.round(tel.motor_rpm ?? 0),
        ambient_temp: parseFloat(tel.ambient_temp ?? 25.0).toFixed(1),
        ambient_humidity: parseFloat(tel.ambient_humidity ?? 50.0).toFixed(0),
        status: status,
        faultClass: faultClass
      };

      const logsRef = collection(db, "users", inspectedVehicle.id, "telemetry_logs");
      addDoc(logsRef, logRecord).catch((e) => console.error("Error logging admin 60s telemetry:", e));
    }, 60000);

    return () => clearInterval(timer);
  }, [inspectedVehicle, inspectedLogs]);

  // STALE LOG RETENTION CLEANUP (>1 Year / 365 Days)
  const pruneStaleLogs = async (retentionDays = 365) => {
    if (!inspectedVehicle?.id) return;
    const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    const staleLogs = inspectedLogs.filter((log) => log.timestampRaw < cutoffTimestamp);
    if (staleLogs.length === 0) {
      alert(`All telemetry logs are fresh! No logs found older than ${retentionDays} days.`);
      return;
    }

    const confirmPurge = window.confirm(
      `Found ${staleLogs.length} telemetry log(s) older than ${retentionDays} days (${retentionDays >= 365 ? "1 year" : retentionDays + " days"}).\n\nWould you like to permanently purge these old records to save database space?\n(Note: Safety incident history in fault_history will NEVER be deleted.)`
    );

    if (!confirmPurge) return;

    setIsCleaningStaleLogs(true);
    try {
      const deletePromises = staleLogs.map((log) => 
        deleteDoc(doc(db, "users", inspectedVehicle.id, "telemetry_logs", log.id))
      );
      await Promise.all(deletePromises);
      alert(`Successfully deleted ${staleLogs.length} stale telemetry log(s)!`);
    } catch (e) {
      console.error("Failed to prune stale logs:", e);
      alert("Error occurred while deleting stale logs. Please check console.");
    } finally {
      setIsCleaningStaleLogs(false);
    }
  };

  const handleInspectVehicle = (vehUser) => {
    setInspectedVehicle(vehUser);
    setShowOwnerDetails(false);
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setActiveFilterQuery(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setActiveFilterQuery("");
  };

  const filteredUsers = fleetUsers.filter((u) => {
    if (u.role === "admin") return false;
    if (!activeFilterQuery) return true;

    const q = activeFilterQuery.toLowerCase();
    const emailMatch = (u.email || "").toLowerCase().includes(q);
    const chassisMatch = (u.chassisNumber || "").toLowerCase().includes(q);
    const phoneMatch = (u.phone || "").toLowerCase().includes(q);
    const nameMatch = (u.fullName || "").toLowerCase().includes(q);
    const plateMatch = (u.vehicleId || "").toLowerCase().includes(q);
    const modelMatch = (u.vehicleModel || "").toLowerCase().includes(q);

    return emailMatch || chassisMatch || phoneMatch || nameMatch || plateMatch || modelMatch;
  });

  // Filter & Sort Fault History
  let displayedFaults = [...inspectedFaults];
  if (filterType === "INCREASES_ONLY") {
    displayedFaults = displayedFaults.filter((f) => f.eventType === "FAULT_INCEPTION" || f.eventType === "FAULT_ESCALATED");
  } else if (filterType === "DECREASES_ONLY") {
    displayedFaults = displayedFaults.filter((f) => f.eventType === "FAULT_DEESCALATED");
  } else if (filterType === "RECOVERIES_ONLY") {
    displayedFaults = displayedFaults.filter((f) => f.eventType === "RECOVERY_NORMAL");
  }

  if (sortOrder === "ASC") {
    displayedFaults.sort((a, b) => a.timestampRaw - b.timestampRaw);
  } else {
    displayedFaults.sort((a, b) => b.timestampRaw - a.timestampRaw);
  }

  // Sort Telemetry Logs
  let displayedLogs = [...inspectedLogs];
  if (sortOrder === "ASC") {
    displayedLogs.sort((a, b) => a.timestampRaw - b.timestampRaw);
  } else {
    displayedLogs.sort((a, b) => b.timestampRaw - a.timestampRaw);
  }

  const exportVehicleLogsCSV = () => {
    if (!inspectedVehicle) return;
    const headers = "Timestamp,Date,Time,Chassis,EventType,FaultCount,PrevCount,Label,AddedFaults,ClearedFaults,ActiveFaults,Voltage_V,Current_A,Temp_C,RPM,AmbientTemp_C,AmbientHumidity_Pct\n";
    const rows = inspectedFaults.map(f => 
      `${f.timestampRaw},${f.date},${f.time},${f.chassis || inspectedVehicle.chassisNumber},${f.eventType},${f.faultCount || 0},${f.prevCount || 0},"${(f.label || '').replace(/"/g, '""')}","${(f.addedFaults || []).join(';') || ''}","${(f.clearedFaults || []).join(';') || ''}","${(f.activeFaults || []).join(';') || ''}",${f.voltage},${f.current},${f.temp},${f.rpm},${f.ambient_temp ?? 25.0},${f.ambient_humidity ?? 50.0}`
    ).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_${inspectedVehicle.vehicleId || inspectedVehicle.chassisNumber}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isInspectedVoltageLow = liveVehicleTelemetry?.Voltage > 0 && liveVehicleTelemetry.Voltage < 3.0;
  const isInspectedTempHigh = liveVehicleTelemetry?.Temperature >= 60.0;
  const isInspectedOverload = liveVehicleTelemetry?.Current >= 2.5;
  const isInspectedFaultActive = isInspectedVoltageLow || isInspectedTempHigh || isInspectedOverload;

  const getInspectFaultTitle = () => {
    const activeWarnings = [];
    if (isInspectedTempHigh) activeWarnings.push("Battery Overheat");
    if (isInspectedVoltageLow) activeWarnings.push("Inverter Voltage Drop");
    if (isInspectedOverload) activeWarnings.push("Motor Overload");

    if (activeWarnings.length > 1) {
      return `Multiple Concurrent Faults (${activeWarnings.length} Active): ${activeWarnings.join(" & ")}`;
    } else if (activeWarnings.length === 1) {
      return activeWarnings[0];
    }
    return "Powertrain Anomaly Alert";
  };

  const getInspectFaultDescription = () => {
    const descriptions = [];
    if (isInspectedTempHigh) descriptions.push(`Battery temp reached ${liveVehicleTelemetry.Temperature.toFixed(1)}°C`);
    if (isInspectedVoltageLow) descriptions.push(`Voltage dropped to ${liveVehicleTelemetry.Voltage.toFixed(2)}V`);
    if (isInspectedOverload) descriptions.push(`Current draw spiked to ${liveVehicleTelemetry.Current.toFixed(2)}A`);

    return descriptions.join(". ") + ". Immediate service inspection recommended.";
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <Navbar 
          currentView={inspectedVehicle ? "inspect" : adminSubView} 
          onNavigate={(view) => {
            if (inspectedVehicle) setInspectedVehicle(null);
            if (view === "home") setAdminSubView("home");
            if (view === "fleet") setAdminSubView("fleet");
            if (view === "about") onOpenAbout();
          }} 
        />

        {inspectedVehicle ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setInspectedVehicle(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Fleet Directory</span>
              </button>

              <button
                onClick={exportVehicleLogsCSV}
                className="px-3.5 py-1.5 rounded-xl border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Audit CSV</span>
              </button>
            </div>

            {/* REAL-TIME VISUAL ALERT BANNER */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
              !isInspectedFaultActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm"
                : "border-rose-300 bg-rose-50 text-rose-900 shadow-sm"
            }`}>
              <div className="flex items-center gap-3">
                {!isInspectedFaultActive ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertOctagon className="w-6 h-6 text-rose-600 flex-shrink-0 animate-bounce" />
                )}
                <div>
                  <div className="text-sm font-bold">
                    {!isInspectedFaultActive ? "Vehicle Status: SAFE TO OPERATE" : `Powertrain Warning: ${getInspectFaultTitle()}`}
                  </div>
                  <div className="text-xs opacity-90 mt-0.5">
                    {!isInspectedFaultActive
                      ? "All telemetry parameters for this vehicle are operating within safe driving bounds."
                      : getInspectFaultDescription()}
                  </div>
                </div>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                !isInspectedFaultActive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}>
                {!isInspectedFaultActive ? "Normal" : "Warning Active"}
              </span>
            </div>

            {/* VEHICLE OWNER DETAILS BUTTON & DRAWER */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Car className="w-5 h-5 text-cyan-600" />
                    <span>{inspectedVehicle.vehicleModel || "Electric Vehicle"}</span>
                    <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 rounded-full text-slate-600">
                      {inspectedVehicle.vehicleId || "VEH-DEFAULT"}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live inspection session for VIN: <strong className="font-mono">{inspectedVehicle.chassisNumber}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowOwnerDetails(!showOwnerDetails)}
                  className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 transition shadow-sm"
                >
                  <User className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Vehicle owner details</span>
                  {showOwnerDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showOwnerDetails && (
                <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-slate-50/70 p-4 rounded-xl">
                  <div className="p-3 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Owner Full Name</span>
                    <span className="font-bold text-slate-800 text-sm mt-0.5 block">{inspectedVehicle.fullName || "—"}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contact Phone</span>
                    <span className="font-bold text-slate-800 text-sm mt-0.5 block">{inspectedVehicle.phone || "—"}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Gmail Address</span>
                    <span className="font-medium text-cyan-700 mt-0.5 block truncate">{inspectedVehicle.email || "—"}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Chassis Number (VIN)</span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block">{inspectedVehicle.chassisNumber || "—"}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Vehicle Model</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{inspectedVehicle.vehicleModel || "—"}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Vehicle Plate / ID</span>
                    <span className="font-mono font-bold text-slate-800 mt-0.5 block">{inspectedVehicle.vehicleId || "—"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* LIVE TELEMETRY SENSOR GAUGES */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Live Telemetry Stream ({inspectedVehicle.chassisNumber})
                  </h3>
                  <p className="text-xs text-slate-400">Continuous telemetry feed from Firebase for this specific vehicle</p>
                </div>

                {liveVehicleTelemetry && liveVehicleTelemetry.Voltage > 0 ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live Stream Active</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full font-semibold">
                    Vehicle Standby / Awaiting Transmission
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                    <span>Battery Voltage</span>
                    <Zap className="w-4 h-4 text-cyan-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                    {parseFloat(liveVehicleTelemetry?.Voltage ?? 0).toFixed(2)} <span className="text-sm font-normal text-slate-500">V</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Main EV Battery Pack</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                    <span>Power Draw</span>
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                    {parseFloat(liveVehicleTelemetry?.Current ?? 0).toFixed(2)} <span className="text-sm font-normal text-slate-500">A</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Motor Electric Current</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                    <span>Motor Speed</span>
                    <Gauge className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                    {Math.round(liveVehicleTelemetry?.motor_rpm ?? 0)} <span className="text-sm font-normal text-slate-500">RPM</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Drive Motor Rotation</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                    <span>Battery Temperature</span>
                    <Thermometer className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                    {parseFloat(liveVehicleTelemetry?.Temperature ?? 0).toFixed(1)} <span className="text-sm font-normal text-slate-500">°C</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Core Pack Health</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                    <span>Outside Temperature</span>
                    <Wind className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                    {parseFloat(liveVehicleTelemetry?.ambient_temp ?? 25.0).toFixed(1)} <span className="text-sm font-normal text-slate-500">°C</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Ambient Weather</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                    <span>Outside Humidity</span>
                    <Droplets className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                    {parseFloat(liveVehicleTelemetry?.ambient_humidity ?? 50.0).toFixed(0)} <span className="text-sm font-normal text-slate-500">%</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Weather Moisture</div>
                </div>
              </div>
            </div>

            {/* 60-SECOND LOGS & TRANSITION TABLES */}
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
                    <span>Fault & Recovery Transitions ({inspectedFaults.length})</span>
                  </button>
                  <button
                    onClick={() => setAuditTab("telemetry_logs")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                      auditTab === "telemetry_logs" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>60-Second Telemetry Logs ({inspectedLogs.length})</span>
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
                      onClick={() => pruneStaleLogs(365)}
                      disabled={isCleaningStaleLogs || inspectedLogs.length === 0}
                      className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs text-rose-700 font-bold flex items-center gap-1 transition disabled:opacity-50"
                      title="Prune records older than 1 year (365 days)"
                    >
                      <Trash2 className="w-3 h-3 text-rose-600" />
                      <span>{isCleaningStaleLogs ? "Pruning..." : "Prune Old Logs (>1 Year)"}</span>
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
                <div className="text-xs text-slate-400 py-8 text-center">Loading database records...</div>
              ) : auditTab === "fault_history" ? (
                displayedFaults.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    <span className="font-medium">No fault state transitions recorded for this vehicle.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase font-mono text-slate-400 bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="py-2.5 px-3">Date & Time</th>
                          <th className="py-2.5 px-3">State Transition</th>
                          <th className="py-2.5 px-3">Fault Changes & Subsystems</th>
                          <th className="py-2.5 px-3">Exact Telemetry Snapshot</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {displayedFaults.map((rec) => {
                          const isInitial = rec.eventType === "FAULT_INCEPTION";
                          const isEscalation = rec.eventType === "FAULT_ESCALATED";
                          const isDeescalation = rec.eventType === "FAULT_DEESCALATED";
                          const isRecovery = rec.eventType === "RECOVERY_NORMAL";

                          return (
                            <tr key={rec.id} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-3 text-slate-600 font-sans">
                                <div className="font-medium text-slate-800">{rec.time}</div>
                                <div className="text-[10px] text-slate-400">{rec.date}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                {isInitial && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                                    <AlertOctagon className="w-3 h-3 text-rose-600" />
                                    <span>FAULT TRIGGERED</span>
                                  </span>
                                )}
                                {isEscalation && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                                    <ArrowUpRight className="w-3 h-3 text-rose-600" />
                                    <span>FAULTS ESCALATED (+{(rec.faultCount || 1) - (rec.prevCount || 0)})</span>
                                  </span>
                                )}
                                {isDeescalation && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                    <ArrowDownRight className="w-3 h-3 text-amber-600" />
                                    <span>FAULTS DECREASED (-{(rec.prevCount || 1) - (rec.faultCount || 0)})</span>
                                  </span>
                                )}
                                {isRecovery && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>RECOVERED TO SAFE OPERATION</span>
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 font-sans">
                                <div className="font-semibold text-slate-900">{rec.label}</div>
                                
                                <div className="mt-1 space-y-0.5 text-[11px]">
                                  {Array.isArray(rec.addedFaults) && rec.addedFaults.length > 0 && (
                                    <div className="text-rose-700 font-medium">
                                      <span className="font-bold">+ Added:</span> {rec.addedFaults.join(", ")}
                                    </div>
                                  )}

                                  {Array.isArray(rec.clearedFaults) && rec.clearedFaults.length > 0 && (
                                    <div className="text-emerald-700 font-medium">
                                      <span className="font-bold">− Cleared:</span> {rec.clearedFaults.join(", ")}
                                    </div>
                                  )}

                                  {Array.isArray(rec.activeFaults) && rec.activeFaults.length > 0 && !isRecovery && (
                                    <div className="text-slate-500 font-mono text-[10px]">
                                      Active Now: {rec.activeFaults.join(" | ")}
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-[11px] text-slate-600 font-mono">
                                <div>
                                  V: <strong className="text-slate-900">{rec.voltage} V</strong> | 
                                  I: <strong className="text-slate-900">{rec.current} A</strong> | 
                                  RPM: <strong className="text-slate-900">{rec.rpm}</strong>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
                                  Battery: <strong className="text-amber-700 font-mono">{rec.temp} °C</strong> | 
                                  Climate: <strong className="text-slate-700 font-mono">{rec.ambient_temp ?? 25.0} °C / {rec.ambient_humidity ?? 50}%</strong>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                displayedLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                    <Clock className="w-6 h-6 text-slate-300" />
                    <span className="font-medium">No 60-second telemetry frames logged yet.</span>
                    <span className="text-[11px] text-slate-400">Continuous logs stream every 60 seconds (1 minute) while vehicle is active.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="text-[10px] uppercase text-slate-400 bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="py-2 px-3">Date & Time</th>
                          <th className="py-2 px-3">Battery Voltage</th>
                          <th className="py-2 px-3">Power Draw</th>
                          <th className="py-2 px-3">Motor Speed</th>
                          <th className="py-2 px-3">Battery Temp</th>
                          <th className="py-2 px-3">Climate (T / Hum)</th>
                          <th className="py-2 px-3">System State</th>
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
                            <td className="py-2 px-3 text-slate-600">{log.ambient_temp}°C / {log.ambient_humidity}%</td>
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
        ) : adminSubView === "fleet" ? (
          /* FLEET DIRECTORY */
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-100 gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Factory className="w-4 h-4 text-cyan-600" />
                  Fleet Vehicles & Owner Directory
                </h2>
                <p className="text-xs text-slate-500">
                  Search by Gmail, Chassis VIN, or Phone to inspect vehicle telemetry.
                </p>
              </div>

              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search Gmail, Chassis VIN, Phone, Name..."
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
                    onClick={handleClearSearch}
                    className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition"
                    title="Clear Search Filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={fetchFleet}
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
                  Showing search results for: <strong>"{activeFilterQuery}"</strong> ({filteredUsers.length} matching vehicles)
                </span>
                <button onClick={handleClearSearch} className="text-cyan-700 underline font-semibold ml-2">
                  Show All
                </button>
              </div>
            )}

            {loadingUsers ? (
              <div className="text-xs text-slate-400 py-8 text-center">Loading fleet registry...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-xs text-slate-400 py-8 text-center">
                No vehicle owners matched your search criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase font-mono text-slate-400 bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3">Vehicle Owner</th>
                      <th className="py-2.5 px-3">Email Address (Gmail)</th>
                      <th className="py-2.5 px-3">Phone</th>
                      <th className="py-2.5 px-3">Vehicle Model</th>
                      <th className="py-2.5 px-3">Chassis Number (VIN)</th>
                      <th className="py-2.5 px-3 text-right">Inspect Telemetry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                          {u.fullName || "Owner"}
                        </td>
                        <td className="py-2.5 px-3 text-cyan-700 font-medium">{u.email}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-600">{u.phone || "—"}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-800 font-medium">{u.vehicleModel || "EV Unit"}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{u.chassisNumber || "—"}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleInspectVehicle(u)}
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
        ) : (
          /* SIMPLE ADMIN PORTAL TILES */
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 font-mono">
                  Manufacturer Operations Console
                </span>
                <h2 className="text-2xl font-black text-slate-900 mt-1">
                  Fleet Administration & Monitoring Portal
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Access fleet vehicle registries, review logged transitions, and inspect customer EV telemetry.
                </p>
              </div>

              <button
                onClick={() => setAdminSubView("fleet")}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/20 flex items-center gap-2"
              >
                <span>Open Fleet Directory</span>
                <Eye className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div 
                onClick={() => setAdminSubView("fleet")}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer space-y-3"
              >
                <span className="p-3 rounded-xl bg-cyan-50 text-cyan-600 inline-block border border-cyan-100">
                  <Factory className="w-6 h-6" />
                </span>
                <h3 className="text-base font-bold text-slate-900">Fleet Directory & Search</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Search across registered owners by Gmail, Chassis VIN, or Phone Number, and open live telematics audits.
                </p>
                <div className="pt-2 text-xs font-bold text-cyan-600 flex items-center gap-1">
                  <span>View Fleet Directory →</span>
                </div>
              </div>

              <div 
                onClick={onOpenAbout}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer space-y-3"
              >
                <span className="p-3 rounded-xl bg-rose-50 text-rose-600 inline-block border border-rose-100">
                  <Layers className="w-6 h-6" />
                </span>
                <h3 className="text-base font-bold text-slate-900">Organization Settings</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Manage manufacturer plant codes, authorized engineering contacts, and account security credentials.
                </p>
                <div className="pt-2 text-xs font-bold text-rose-600 flex items-center gap-1">
                  <span>Edit Organization Profile →</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
                <span className="p-3 rounded-xl bg-emerald-50 text-emerald-600 inline-block border border-emerald-100">
                  <Users className="w-6 h-6" />
                </span>
                <h3 className="text-base font-bold text-slate-900">Registered EV Units</h3>
                <div className="text-2xl font-black font-mono text-slate-900">
                  {fleetUsers.filter(u => u.role !== "admin").length} <span className="text-xs font-normal text-slate-400">Total Enrolled</span>
                </div>
                <p className="text-xs text-slate-500">
                  Active vehicle nodes streaming into multi-tenant Firebase partitions.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}