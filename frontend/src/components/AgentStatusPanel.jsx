// src/components/AgentStatusPanel.jsx
import React from "react";
import { ShieldCheck, Cpu, Wrench } from "lucide-react";
import { useTelemetry } from "../context/TelemetryContext";

export default function AgentStatusPanel() {
  const { agentResult } = useTelemetry();
  const diagnosis = agentResult?.diagnosis;
  const booking = agentResult?.booking;
  const state = agentResult?.orchestrator_state || "ACTIVE_MONITORING";
  const isAnomaly = state === "ANOMALY_ESCALATED";

  return (
    <div className="space-y-4">
      {/* 1. Master Safety Agent */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Safety Supervisor
            </h3>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
            !isAnomaly
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-300"
          }`}>
            {!isAnomaly ? "MONITORING ACTIVE" : "WARNING ACTIVE"}
          </span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Continuously evaluates all 6 vehicle readings and activates instant safety outreach when bounds are breached.
        </p>
      </div>

      {/* 2. Diagnostic Engine */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Vehicle Health Status
            </h3>
          </div>
          <span className="text-[10px] font-sans font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
            Autonomous
          </span>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Operating Condition:</span>
            <span className="font-bold text-slate-900">{diagnosis?.diagnosis_label || "Nominal"}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Monitored System:</span>
            <span className="font-bold text-slate-700">{diagnosis?.affected_subsystem || "Main Powertrain"}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Safety State:</span>
            <span className={`font-bold ${!isAnomaly ? "text-emerald-700" : "text-rose-700"}`}>
              {!isAnomaly ? "Safe Driving Bounds" : "Immediate Inspection Required"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Service Outreach Agent */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Service Reservation
            </h3>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
            booking?.booking_required
              ? "bg-amber-50 text-amber-800 border-amber-200"
              : "bg-slate-100 text-slate-500 border-slate-200"
          }`}>
            {booking?.booking_required ? "BAY RESERVED" : "STANDBY"}
          </span>
        </div>

        {booking?.booking_required ? (
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1 text-xs">
            <div className="font-bold text-amber-900 flex justify-between">
              <span>Booking Ticket:</span>
              <span className="font-mono">{booking.booking_id}</span>
            </div>
            <div className="text-slate-600 text-[11px]">{booking.assigned_bay}</div>
            <div className="text-slate-500 text-[11px] font-medium">{booking.service_hub}</div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 leading-relaxed">
            All powertrain parameters within safe threshold limits. No active service reservation required.
          </p>
        )}
      </div>
    </div>
  );
}