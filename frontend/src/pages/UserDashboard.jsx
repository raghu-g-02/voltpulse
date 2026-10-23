// src/pages/UserDashboard.jsx
import React, { useState } from "react";
import Navbar from "../components/Navbar";
import EditProfileModal from "../components/EditProfileModal";
import { useAuth } from "../context/AuthContext";
import { useTelemetry } from "../context/TelemetryContext";
import { 
  Zap, Activity, Gauge, Thermometer, Wind, Droplets, 
  AlertOctagon, CheckCircle2, Volume2, VolumeX, 
  Edit3, ShieldCheck, Cpu, Waves, Play, RotateCcw
} from "lucide-react";

export default function UserDashboard({ onOpenAbout }) {
  const { userProfile } = useAuth();
  const { 
    telemetry, 
    agentResult, 
    source, 
    isVoiceMuted, 
    toggleVoiceMute,
    triggerSimulation,
    isSimulating
  } = useTelemetry();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("cockpit");

  const cal = userProfile?.calibration || {
    modelName: "3S Hardware Testbench (12V L298N)",
    manufacturer: "VoltPulse Lab Rig",
    voltage_nominal: 11.8,
    voltage_sag_limit: 9.8,
    current_nominal: 0.20,
    current_overload_limit: 0.85,
    temp_nominal: 28.0,
    temp_critical_limit: 38.0,
    rpm_max_rated: 260,
  };

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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <Navbar 
          currentView={activeTab} 
          onNavigate={(view) => {
            if (view === "about") onOpenAbout();
            else setActiveTab(view);
          }} 
        />

        {/* Live Status Header */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 font-mono">
                {cal.manufacturer} • {cal.modelName}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                VIN: {userProfile?.chassisNumber || "MAT612089N1A23456"}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1">Vehicle Telematics Cockpit</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Telemetry feed: <strong className="font-mono text-cyan-700">{source || "STANDBY"}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              <span>Edit All Details</span>
            </button>
          </div>
        </div>

        {/* Real-time Status Alert Banner */}
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
                {!isFaultActive ? `Status: SAFE (${cal.modelName})` : `Safety Breach: ${faultLabel}`}
              </div>
              <div className="text-xs opacity-90 mt-0.5">
                Calibrated limits: Voltage &gt; {cal.voltage_sag_limit}V, Current &lt; {cal.current_overload_limit}A, Temp &lt; {cal.temp_critical_limit}°C.
              </div>
            </div>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-bold ${
            !isFaultActive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
          }`}>
            {!isFaultActive ? "Nominal" : "Fault Active"}
          </span>
        </div>

        {/* Interactive Live Demo Simulation Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
              Live Hardware Demo Controls
            </span>
            <span className="text-slate-400 text-[11px]">
              Simulate or clear fault triggers to demonstrate real-time AI diagnosis and voice outreach.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => triggerSimulation(0)}
              className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold transition flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3 text-emerald-600" />
              <span>Reset Nominal</span>
            </button>

            <button
              onClick={() => triggerSimulation(1)}
              className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold transition flex items-center gap-1"
            >
              <Play className="w-3 h-3 text-rose-600" />
              <span>Motor Stall (1.15A)</span>
            </button>

            <button
              onClick={() => triggerSimulation(2)}
              className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold transition flex items-center gap-1"
            >
              <Play className="w-3 h-3 text-amber-600" />
              <span>Voltage Sag (9.2V)</span>
            </button>

            <button
              onClick={() => triggerSimulation(3)}
              className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold transition flex items-center gap-1"
            >
              <Play className="w-3 h-3 text-rose-600" />
              <span>Thermal Runaway (41.5°C)</span>
            </button>
          </div>
        </div>

        {/* 10-Channel Live Sensor Readings */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Live Physical Sensor Telemetry (ESP32)
              </h2>
              <p className="text-xs text-slate-400">Continuous 2s Stream via Firebase Realtime Database</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{source.includes("FIREBASE") ? "ESP32 Live Stream" : "Simulation Injected"}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {/* Battery Voltage */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>3S Battery Pack</span>
                <Zap className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                {v.toFixed(2)} <span className="text-sm font-normal text-slate-500">V</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Sag Limit: &le; {cal.voltage_sag_limit} V</div>
            </div>

            {/* Current Draw */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>Motor Current</span>
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                {i.toFixed(2)} <span className="text-sm font-normal text-slate-500">A</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Overload: &ge; {cal.current_overload_limit} A</div>
            </div>

            {/* Motor RPM */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>LM393 Tachometer</span>
                <Gauge className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                {rpm} <span className="text-sm font-normal text-slate-500">RPM</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Max Rated: {cal.rpm_max_rated} RPM</div>
            </div>

            {/* Core Battery Temp */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>DS18B20 Temp Probe</span>
                <Thermometer className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                {t.toFixed(1)} <span className="text-sm font-normal text-slate-500">°C</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Thermal Cutoff: &ge; {cal.temp_critical_limit} °C</div>
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

            {/* MPU6050 Lateral Vibration */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>MPU-6050 Lateral Vib</span>
                <Waves className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                {(Math.sqrt(vib_x**2 + vib_y**2)).toFixed(2)} <span className="text-sm font-normal text-slate-500">m/s²</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">X: {vib_x.toFixed(2)} | Y: {vib_y.toFixed(2)}</div>
            </div>

            {/* MPU6050 Z-Axis Gravity */}
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

        {/* Profile Card View */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                <span>Vehicle Owner Specification & Calibration Link</span>
              </h2>
              <p className="text-xs text-slate-400">Registered parameters and manufacturer threshold binding</p>
            </div>

            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1 transition"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Details</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Owner Full Name</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">{userProfile?.fullName || "Raghu"}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Vehicle Company</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">{cal.manufacturer}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Model Variant</span>
              <span className="font-bold text-cyan-700 text-sm mt-0.5 block">{cal.modelName}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Chassis Number (VIN)</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{userProfile?.chassisNumber || "MAT612089N1A23456"}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Vehicle Plate / ID</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{userProfile?.vehicleId || "VEH-A23456"}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contact Phone</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">{userProfile?.phone || "+91 9187654320"}</span>
            </div>
          </div>
        </div>
      </div>

      <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
    </div>
  );
}