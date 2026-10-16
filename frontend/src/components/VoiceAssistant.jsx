// src/components/VoiceAssistant.jsx
import React, { useState } from "react";
import { Volume2, VolumeX, Play, Check } from "lucide-react";
import { useTelemetry } from "../context/TelemetryContext";

export default function VoiceAssistant() {
  const { agentResult, isVoiceMuted, toggleVoiceMute, speakText } = useTelemetry();
  const [testPlaying, setTestPlaying] = useState(false);

  const script = agentResult?.outreach?.voice_script;

  const handleTestSpeech = () => {
    setTestPlaying(true);
    speakText(script || "VoltPulse AI audio assistant is functioning nominally.");
    setTimeout(() => setTestPlaying(false), 3000);
  };

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`p-2.5 rounded-xl ${!isVoiceMuted ? "bg-cyan-50 text-cyan-700 border border-cyan-200" : "bg-slate-100 text-slate-400"}`}>
          {!isVoiceMuted ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </span>
        <div>
          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <span>In-Vehicle Infotainment Voice Co-Pilot</span>
          </div>
          <p className="text-xs text-slate-600 italic mt-0.5 max-w-xl">
            "{script || "All vehicle systems are looking healthy and running smoothly."}"
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleTestSpeech}
          disabled={testPlaying || isVoiceMuted}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          title="Test Voice Speech Output"
        >
          {testPlaying ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Play className="w-3.5 h-3.5 text-cyan-600" />}
          <span>{testPlaying ? "Speaking..." : "Test Speech"}</span>
        </button>
      </div>
    </div>
  );
}