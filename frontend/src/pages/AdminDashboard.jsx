// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import AdminPortalHome from "../components/admin/AdminPortalHome";
import VehicleModelManager from "../components/admin/VehicleModelManager";
import FleetDirectory from "../components/admin/FleetDirectory";
import VehicleInspector from "../components/admin/VehicleInspector";

import { collection, getDocs, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

export default function AdminDashboard({ onBackToHome, onOpenAbout, initialSubView = "home" }) {
  const { userProfile } = useAuth();
  const [adminSubView, setAdminSubView] = useState(initialSubView); // "home" | "fleet" | "models" | "inspect"

  const [fleetUsers, setFleetUsers] = useState([]);
  const [vehicleModels, setVehicleModels] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Search filter
  const [searchInput, setSearchInput] = useState("");
  const [activeFilterQuery, setActiveFilterQuery] = useState("");

  // Inspect state
  const [inspectedVehicle, setInspectedVehicle] = useState(null);
  const [liveVehicleTelemetry, setLiveVehicleTelemetry] = useState(null);
  const [inspectedFaults, setInspectedFaults] = useState([]);
  const [inspectedLogs, setInspectedLogs] = useState([]);
  const [loadingAuditData, setLoadingAuditData] = useState(false);
  const [isCleaningStaleLogs, setIsCleaningStaleLogs] = useState(false);

  // Fetch Models Catalog
  const fetchVehicleModels = async () => {
    try {
      const snap = await getDocs(collection(db, "vehicle_models"));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setVehicleModels(list);
    } catch (err) {
      console.error("Failed to load vehicle models:", err);
    }
  };

  // Fetch Fleet Directory
  const fetchFleet = async () => {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setFleetUsers(list.filter((u) => u.role !== "admin"));
    } catch (err) {
      console.error("Failed to load fleet registry:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchVehicleModels();
    fetchFleet();
  }, []);

  // Poll live telemetry when inspecting a vehicle
  useEffect(() => {
    if (!inspectedVehicle?.chassisNumber) {
      setLiveVehicleTelemetry(null);
      return;
    }

    const pollLive = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/state/latest/${inspectedVehicle.chassisNumber}`);
        const data = await res.json();
        if (data.telemetry) setLiveVehicleTelemetry(data.telemetry);
      } catch (e) {
        console.error("Error polling vehicle telemetry:", e);
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
      snapshot.forEach((d) => fRecords.push({ id: d.id, ...d.data() }));
      setInspectedFaults(fRecords);
      setLoadingAuditData(false);
    });

    const logQ = query(collection(db, "users", inspectedVehicle.id, "telemetry_logs"), orderBy("timestampRaw", "desc"));
    const unsubLogs = onSnapshot(logQ, (snapshot) => {
      const lRecords = [];
      snapshot.forEach((d) => lRecords.push({ id: d.id, ...d.data() }));
      setInspectedLogs(lRecords);
    });

    return () => {
      unsubFaults();
      unsubLogs();
    };
  }, [inspectedVehicle]);

  // Prune Stale Logs Utility (>365 Days)
  const pruneStaleLogs = async (retentionDays = 365) => {
    if (!inspectedVehicle?.id) return;
    const cutoffTimestamp = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const staleLogs = inspectedLogs.filter((log) => log.timestampRaw < cutoffTimestamp);

    if (staleLogs.length === 0) {
      alert(`All telemetry logs are fresh! No logs found older than ${retentionDays} days.`);
      return;
    }

    const confirmPurge = window.confirm(`Purge ${staleLogs.length} logs older than ${retentionDays} days?`);
    if (!confirmPurge) return;

    setIsCleaningStaleLogs(true);
    try {
      const promises = staleLogs.map((log) => deleteDoc(doc(db, "users", inspectedVehicle.id, "telemetry_logs", log.id)));
      await Promise.all(promises);
      alert(`Deleted ${staleLogs.length} stale logs.`);
    } catch (e) {
      console.error("Failed to prune stale logs:", e);
    } finally {
      setIsCleaningStaleLogs(false);
    }
  };

  const exportVehicleLogsCSV = () => {
    if (!inspectedVehicle) return;
    const headers = "Timestamp,Date,Time,Chassis,EventType,Label,Voltage_V,Current_A,Temp_C,RPM\n";
    const rows = inspectedFaults.map((f) =>
      `${f.timestampRaw},${f.date},${f.time},${f.chassis || inspectedVehicle.chassisNumber},${f.eventType},"${(f.label || "").replace(/"/g, '""')}",${f.voltage},${f.current},${f.temp},${f.rpm}`
    ).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_${inspectedVehicle.chassisNumber}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Find assigned model calibration for the inspected vehicle
  const activeModelCalibration = vehicleModels.find(
    (m) => m.modelName?.toLowerCase() === inspectedVehicle?.vehicleModel?.toLowerCase() || m.id === inspectedVehicle?.vehicleModel
  ) || vehicleModels[0];

  const filteredFleet = fleetUsers.filter((u) => {
    if (!activeFilterQuery) return true;
    const q = activeFilterQuery.toLowerCase();
    return (
      (u.email || "").toLowerCase().includes(q) ||
      (u.chassisNumber || "").toLowerCase().includes(q) ||
      (u.fullName || "").toLowerCase().includes(q) ||
      (u.vehicleModel || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <Navbar 
          currentView={inspectedVehicle ? "inspect" : adminSubView} 
          onNavigate={(view) => {
            if (inspectedVehicle) setInspectedVehicle(null);
            if (view === "home") setAdminSubView("home");
            if (view === "fleet") setAdminSubView("fleet");
            if (view === "models") setAdminSubView("models");
            if (view === "about") onOpenAbout();
          }}
        />

        {inspectedVehicle ? (
          <VehicleInspector
            vehicle={inspectedVehicle}
            modelCalibration={activeModelCalibration}
            liveTelemetry={liveVehicleTelemetry}
            faults={inspectedFaults}
            logs={inspectedLogs}
            loadingAuditData={loadingAuditData}
            onBack={() => setInspectedVehicle(null)}
            onExportCSV={exportVehicleLogsCSV}
            onPruneLogs={pruneStaleLogs}
            isCleaningLogs={isCleaningStaleLogs}
          />
        ) : adminSubView === "models" ? (
          <VehicleModelManager
            vehicleModels={vehicleModels}
            manufacturerName={userProfile?.companyName || userProfile?.fullName || "Automotive OEM"}
            onRefresh={fetchVehicleModels}
          />
        ) : adminSubView === "fleet" ? (
          <FleetDirectory
            fleetUsers={filteredFleet}
            loadingUsers={loadingUsers}
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            activeFilterQuery={activeFilterQuery}
            onSearchSubmit={(e) => { e.preventDefault(); setActiveFilterQuery(searchInput.trim()); }}
            onClearSearch={() => { setSearchInput(""); setActiveFilterQuery(""); }}
            onRefresh={fetchFleet}
            onInspectVehicle={(v) => setInspectedVehicle(v)}
          />
        ) : (
          <AdminPortalHome
            onNavigateSubView={(sub) => setAdminSubView(sub)}
            totalVehicles={fleetUsers.length}
            totalModels={vehicleModels.length}
            onOpenAbout={onOpenAbout}
          />
        )}
      </div>
    </div>
  );
}