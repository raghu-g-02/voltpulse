// src/components/TelemetryGrid.jsx
import React from "react";
import { Zap, Activity, Gauge, Thermometer, Wind, Droplets } from "lucide-react";
import { useTelemetry } from "../context/TelemetryContext";

export default function TelemetryGrid() {
  const { telemetry } = useTelemetry();

  const ax = telemetry.vibration_x || 0.05;
  const ay = telemetry.vibration_y || 0.08;
  const az = telemetry.vibration_z || 9.82;
  const dynamicVibrationG = Math.max(0.0, Math.abs(Math.sqrt(ax * ax + ay * ay + az * az) / 9.80665 - 1.0));

  const items = [
    {
      label: "Battery Voltage",
      value: parseFloat(telemetry.Voltage ?? telemetry.bus_voltage ?? 0).toFixed(2),
      unit: "V",
      desc: "Main EV Battery Pack",
      icon: Zap,
      color: "text-cyan-600",
      bg: "bg-cyan-50"
    },
    {
      label: "Power Draw",
      value: parseFloat(telemetry.Current ?? telemetry.current_amps ?? 0).toFixed(2),
      unit: "A",
      desc: "Motor Electric Current",
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      label: "Motor Speed",
      value: Math.round(telemetry.motor_rpm ?? 0),
      unit: "RPM",
      desc: "Drive Motor Rotation",
      icon: Gauge,
      color: "text-indigo-600",
      bg: "bg-indigo-50"
    },
    {
      label: "Battery Temperature",
      value: parseFloat(telemetry.Temperature ?? telemetry.motor_temp ?? 0).toFixed(1),
      unit: "°C",
      desc: "Core Pack Health",
      icon: Thermometer,
      color: "text-amber-600",
      bg: "bg-amber-50"
    },
    {
      label: "Outside Temperature",
      value: parseFloat(telemetry.ambient_temp ?? 25.0).toFixed(1),
      unit: "°C",
      desc: "Ambient Weather",
      icon: Wind,
      color: "text-emerald-600",
      bg: "bg-emerald-50"
    },
    {
      label: "Outside Humidity",
      value: parseFloat(telemetry.ambient_humidity ?? 50.0).toFixed(0),
      unit: "%",
      desc: "Weather Moisture",
      icon: Droplets,
      color: "text-teal-600",
      bg: "bg-teal-50"
    }
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        {items.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                <span>{m.label}</span>
                <span className={`p-1.5 rounded-lg ${m.bg} ${m.color}`}>
                  <Icon className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                {m.value} <span className="text-sm font-normal text-slate-500">{m.unit}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 truncate">{m.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Ride Smoothness Bar */}
      <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap justify-between items-center text-xs shadow-sm">
        <span className="text-slate-600 flex items-center gap-1.5 font-medium">
          <Activity className="w-4 h-4 text-cyan-600" />
          <span>Vehicle Motion & Ride Stability:</span>
        </span>
        <span className="font-mono font-bold text-slate-800">
          {dynamicVibrationG < 0.2 ? "Smooth & Stable" : dynamicVibrationG < 0.6 ? "Moderate Road Bumpiness" : "High Vibration Detected"}
          {" "}<span className="text-slate-400 font-normal text-[11px]">({dynamicVibrationG.toFixed(3)} g motion)</span>
        </span>
      </div>
    </div>
  );
}