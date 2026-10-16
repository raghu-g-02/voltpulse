// src/pages/UserDashboard.jsx
import React from "react";
import Navbar from "../components/Navbar";
import TelemetryGrid from "../components/TelemetryGrid";
import TelemetryChart from "../components/TelemetryChart";
import VoiceAssistant from "../components/VoiceAssistant";
import { 
  CheckCircle2, AlertOctagon, History, Trash2, ArrowUpRight, ArrowDownRight, RefreshCw 
} from "lucide-react";
import { doc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useTelemetry } from "../context/TelemetryContext";

export default function UserDashboard({ onBackToHome, onOpenAbout }) {
  const { currentUser } = useAuth();
  const { agentResult, faultHistory } = useTelemetry();
  const faultClass = agentResult?.diagnosis?.fault_class ?? 0;
  const isSafe = faultClass === 0;

  const deleteSingleRecord = async (docId) => {
    if (!currentUser || !docId) return;
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "fault_history", docId));
    } catch (e) {
      console.error("Failed to delete record:", e);
    }
  };

  const clearAllHistory = async () => {
    if (!currentUser) return;
    try {
      const snap = await getDocs(collection(db, "users", currentUser.uid, "fault_history"));
      const promises = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(promises);
    } catch (e) {
      console.error("Failed to clear fault history:", e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Navbar currentView="console" onNavigate={(view) => {
          if (view === "home") onBackToHome();
          if (view === "about") onOpenAbout();
        }} />

        {/* Live Operational State Banner */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
          isSafe
            ? "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm"
            : "border-rose-300 bg-rose-50 text-rose-900 shadow-sm"
        }`}>
          <div className="flex items-center gap-3">
            {isSafe ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertOctagon className="w-6 h-6 text-rose-600 flex-shrink-0 animate-bounce" />
            )}
            <div>
              <div className="text-sm font-bold">
                {isSafe ? "Vehicle Status: SAFE TO OPERATE" : `Powertrain Warning: ${agentResult?.diagnosis?.diagnosis_label}`}
              </div>
              <div className="text-xs opacity-90 mt-0.5">
                {isSafe
                  ? "All vehicle telemetry parameters are operating within safe driving limits."
                  : "Anomalous reading detected. Driver advisory announced and owner notified."}
              </div>
            </div>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-bold ${
            isSafe ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
          }`}>
            {isSafe ? "Normal" : "Action Required"}
          </span>
        </div>

        {/* In-Cabin Infotainment Audio Co-Pilot Card */}
        <VoiceAssistant />

        {/* Live Telemetry Grid */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Live Sensor Readings
            </h3>
            <span className="text-xs text-slate-400 font-mono">Continuous 2s Stream</span>
          </div>
          <TelemetryGrid />
        </div>

        {/* Rolling Trend Chart */}
        <TelemetryChart />

        {/* FAULT TRANSITION HISTORY (INCREASES, DECREASES & RECOVERIES) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Fault Transition & Resolution History
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                {faultHistory.length} Event{faultHistory.length === 1 ? "" : "s"}
              </span>
            </div>

            {faultHistory.length > 0 && (
              <button
                onClick={clearAllHistory}
                className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 transition font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {faultHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <span className="font-medium">No recorded faults for this vehicle.</span>
              <span className="text-[11px] text-slate-400">
                All initial faults, escalation increases, partial de-escalations, and safe normal recoveries will log here automatically.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase font-mono text-slate-400 bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">State Transition</th>
                    <th className="py-2.5 px-3">Fault Changes & Active Components</th>
                    <th className="py-2.5 px-3">Exact Telemetry Snapshot</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {faultHistory.map((rec) => {
                    const isInitial = rec.eventType === "FAULT_INCEPTION";
                    const isEscalation = rec.eventType === "FAULT_ESCALATED";
                    const isDeescalation = rec.eventType === "FAULT_DEESCALATED";
                    const isRecovery = rec.eventType === "RECOVERY_NORMAL";
                    const isShift = rec.eventType === "FAULT_TRANSITION";

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
                          {isShift && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 text-purple-600" />
                              <span>FAULT SHIFTED</span>
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

                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => deleteSingleRecord(rec.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete this record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}