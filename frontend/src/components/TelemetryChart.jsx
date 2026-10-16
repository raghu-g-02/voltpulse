// src/components/TelemetryChart.jsx
import React, { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useTelemetry } from "../context/TelemetryContext";
import { LineChart as ChartIcon } from "lucide-react";

export default function TelemetryChart() {
  const { history } = useTelemetry();
  const [activeMetric, setActiveMetric] = useState("voltage");

  const metricConfig = {
    voltage: { name: "Bus Voltage", unit: "V", color: "#0284c7" },
    current: { name: "Current Draw", unit: "A", color: "#2563eb" },
    temperature: { name: "Core Temp", unit: "°C", color: "#d97706" },
    rpm: { name: "Motor Speed", unit: "RPM", color: "#4f46e5" }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-2">
          <ChartIcon className="w-4 h-4 text-cyan-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Real-Time Powertrain Dynamics (20-Point Buffer)
          </h3>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex rounded-xl bg-slate-50 p-1 border border-slate-200 text-xs">
          {Object.keys(metricConfig).map((key) => (
            <button
              key={key}
              onClick={() => setActiveMetric(key)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeMetric === key ? "bg-white text-cyan-700 shadow-sm font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {metricConfig[key].name}
            </button>
          ))}
        </div>
      </div>

      <div className="h-56 mt-4 w-full">
        {history.length < 2 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
            Accumulating real-time sensor frames...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "12px", fontSize: "12px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                itemStyle={{ color: metricConfig[activeMetric].color }}
              />
              <Line
                type="monotone"
                dataKey={activeMetric}
                name={`${metricConfig[activeMetric].name} (${metricConfig[activeMetric].unit})`}
                stroke={metricConfig[activeMetric].color}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}