// src/pages/PublicHomePage.jsx
import React from "react";
import { Zap, ShieldCheck, Activity, Cpu, ArrowRight, Radio, BellRing, Car } from "lucide-react";

export default function PublicHomePage({ onNavigateToAuth }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-600 text-white shadow-md shadow-cyan-600/20">
              <Zap className="w-5 h-5" />
            </span>
            <div>
              <span className="text-lg font-black text-slate-900 tracking-tight">VoltPulse AI</span>
              <span className="hidden sm:inline-block text-[11px] text-slate-500 font-medium ml-2 border-l border-slate-200 pl-2">
                Autonomous EV Powertrain Telematics
              </span>
            </div>
          </div>

          <button
            onClick={onNavigateToAuth}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-md shadow-cyan-600/20 flex items-center gap-2"
          >
            <span>Portal Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 py-12 md:py-16 space-y-12">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 text-cyan-600 animate-pulse" />
            <span>Dual-Layer IoT Edge Inference & Cloud Intelligence</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Next-Generation Predictive Diagnostics for Electric Vehicles
          </h1>
          <p className="text-sm md:text-base text-slate-600 leading-relaxed">
            VoltPulse AI continuously evaluates electro-thermal and kinematic telemetry directly from vehicle battery packs, inverters, and drivetrains—detecting failure precursors and executing autonomous remediation before hardware breakdown occurs.
          </p>

          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={onNavigateToAuth}
              className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition shadow-lg shadow-cyan-600/25 flex items-center gap-2"
            >
              <span>Launch Telematics Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-3">
            <span className="p-3 rounded-xl bg-cyan-50 text-cyan-600 inline-block border border-cyan-100">
              <Cpu className="w-6 h-6" />
            </span>
            <h3 className="text-base font-bold text-slate-900">Sub-5ms Inference at Edge</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Trained on a balanced distribution across Nominal, Motor Overload, Inverter Sag, and Thermal Runaway states with Per-Unit scaling from 5V to 100V.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-3">
            <span className="p-3 rounded-xl bg-blue-50 text-blue-600 inline-block border border-blue-100">
              <Activity className="w-6 h-6" />
            </span>
            <h3 className="text-base font-bold text-slate-900">Synchronized 6-Channel Stream</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Direct telemetry mirror between physical I2C OLED screens and the cloud: DC Voltage, Current, RPM, Core Temperature, Ambient Temperature, and Relative Humidity.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-3">
            <span className="p-3 rounded-xl bg-amber-50 text-amber-600 inline-block border border-amber-100">
              <BellRing className="w-6 h-6" />
            </span>
            <h3 className="text-base font-bold text-slate-900">Closed-Loop Remediation</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Natural conversational spoken guidance for the driver, lock-screen notifications, instant Gmail telemetry dispatches, and autonomous dealership service bay reservation.
            </p>
          </div>
        </div>

        {/* OEM EV Compatibility Row */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
              <Car className="w-6 h-6" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Compatible with Production Electric Vehicle Platforms</h4>
              <p className="text-xs text-slate-500">Universal Per-Unit normalization integrates with Tata Nexon EV, MG ZS EV, and custom testbenches.</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-xl border border-cyan-200">
            ISO 26262 ASIL-D Compliant Architecture
          </span>
        </div>
      </main>
    </div>
  );
}