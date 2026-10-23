// src/components/admin/VehicleModelManager.jsx
import React, { useState } from "react";
import { Sliders, Plus, Trash2, Edit3, Check, X, ShieldCheck, Cpu, ArrowLeft, ShieldAlert } from "lucide-react";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

export default function VehicleModelManager({ vehicleModels, manufacturerName, onRefresh, onBack }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialForm = {
    modelName: "Nexon EV",
    manufacturer: manufacturerName || "Tata Motors",
    voltage_min: 9.8,
    voltage_nominal: 11.8,
    voltage_max: 12.6,
    current_nominal: 0.20,
    current_max: 0.85,
    temp_nominal: 28.0,
    temp_max: 38.0,
    rpm_min: 30,
    rpm_max: 260,
    vibration_max: 2.2,
    chassisInput: "MAT612089N1A23456",
  };

  const [formData, setFormData] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const handleEditClick = (model) => {
    setEditingId(model.id);
    setFormData({
      modelName: model.modelName || "",
      manufacturer: model.manufacturer || manufacturerName || "Tata Motors",
      voltage_min: model.voltage_min ?? model.voltage_sag_limit ?? 9.8,
      voltage_nominal: model.voltage_nominal ?? 11.8,
      voltage_max: model.voltage_max ?? 12.6,
      current_nominal: model.current_nominal ?? 0.20,
      current_max: model.current_max ?? model.current_overload_limit ?? 0.85,
      temp_nominal: model.temp_nominal ?? 28.0,
      temp_max: model.temp_max ?? model.temp_critical_limit ?? 38.0,
      rpm_min: model.rpm_min ?? 30,
      rpm_max: model.rpm_max ?? model.rpm_max_rated ?? 260,
      vibration_max: model.vibration_max ?? model.vibration_limit ?? 2.2,
      chassisInput: Array.isArray(model.assignedChassis) ? model.assignedChassis.join(", ") : "",
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(initialForm);
  };

  const handleSaveModel = async (e) => {
    e.preventDefault();
    if (!formData.modelName.trim()) {
      alert("Please enter a valid model name.");
      return;
    }

    setSaving(true);
    const docId = editingId || formData.modelName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const chassisArray = formData.chassisInput
      .split(/[\n,]+/)
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length > 0);

    const payload = {
      id: docId,
      modelName: formData.modelName.trim(),
      manufacturer: formData.manufacturer.trim() || manufacturerName || "Tata Motors",
      voltage_min: parseFloat(formData.voltage_min) || 0.0,
      voltage_nominal: parseFloat(formData.voltage_nominal) || 11.8,
      voltage_max: parseFloat(formData.voltage_max) || 15.0,
      voltage_sag_limit: parseFloat(formData.voltage_min) || 0.0,
      current_nominal: parseFloat(formData.current_nominal) || 0.20,
      current_max: parseFloat(formData.current_max) || 0.85,
      current_overload_limit: parseFloat(formData.current_max) || 0.85,
      temp_nominal: parseFloat(formData.temp_nominal) || 28.0,
      temp_max: parseFloat(formData.temp_max) || 38.0,
      temp_critical_limit: parseFloat(formData.temp_max) || 38.0,
      rpm_min: parseFloat(formData.rpm_min) || 0,
      rpm_max: parseFloat(formData.rpm_max) || 260,
      rpm_max_rated: parseFloat(formData.rpm_max) || 260,
      vibration_max: parseFloat(formData.vibration_max) || 2.2,
      vibration_limit: parseFloat(formData.vibration_max) || 2.2,
      assignedChassis: chassisArray,
      updatedAt: Date.now(),
    };

    try {
      // 1. Save to Firestore vehicle_models catalog
      await setDoc(doc(db, "vehicle_models", docId), payload, { merge: true });

      // 2. Sync directly with the active backend engine
      await fetch(`${API_BASE}/api/models/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: docId, modelData: payload }),
      }).catch(() => {});

      handleCancel();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Failed to save model:", err);
      alert("Error saving vehicle model to database.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModel = async (modelId, name) => {
    const confirmDel = window.confirm(`Delete model "${name}"?`);
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, "vehicle_models", modelId));
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Failed to delete model:", err);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {onBack && (
        <button
          onClick={onBack}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-sm w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Console Overview</span>
        </button>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-600" />
              OEM Model Threshold Envelope Catalog
            </h2>
            <p className="text-xs text-slate-500">
              Thresholds set here apply to all customer vehicles linked to this model variant.
            </p>
          </div>

          {!isAdding && (
            <button
              onClick={() => {
                setFormData(initialForm);
                setEditingId(null);
                setIsAdding(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Vehicle Model</span>
            </button>
          )}
        </div>

        {isAdding && (
          <form onSubmit={handleSaveModel} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800">
                {editingId ? `Edit Model Calibration: ${formData.modelName}` : "Register New Vehicle Model"}
              </span>
              <button type="button" onClick={handleCancel} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Company / OEM</label>
                <input
                  type="text"
                  required
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Model Name</label>
                <input
                  type="text"
                  required
                  value={formData.modelName}
                  onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-rose-600 uppercase block mb-1">Voltage Min (Sag Cutoff)</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={formData.voltage_min}
                  onChange={(e) => setFormData({ ...formData, voltage_min: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-rose-200 rounded-lg font-mono font-bold text-rose-700"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Voltage Nominal</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={formData.voltage_nominal}
                  onChange={(e) => setFormData({ ...formData, voltage_nominal: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-rose-600 uppercase block mb-1">Voltage Max (Surge)</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={formData.voltage_max}
                  onChange={(e) => setFormData({ ...formData, voltage_max: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-rose-200 rounded-lg font-mono font-bold text-rose-700"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-rose-600 uppercase block mb-1">Current Overload Cutoff (A)</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={formData.current_max}
                  onChange={(e) => setFormData({ ...formData, current_max: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-rose-200 rounded-lg font-mono font-bold text-rose-700"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-amber-600 uppercase block mb-1">Thermal Max Cutoff (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={formData.temp_max}
                  onChange={(e) => setFormData({ ...formData, temp_max: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg font-mono font-bold text-amber-700"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Rated Max RPM</label>
                <input
                  type="number"
                  step="10"
                  required
                  value={formData.rpm_max}
                  onChange={(e) => setFormData({ ...formData, rpm_max: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-purple-600 uppercase block mb-1">Max Vibration (m/s²)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formData.vibration_max}
                  onChange={(e) => setFormData({ ...formData, vibration_max: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-purple-200 rounded-lg font-mono font-bold text-purple-700"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="text-[10px] font-semibold text-cyan-800 uppercase block mb-1 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-600" />
                <span>Authorized Chassis Numbers (VINs) for this Model (Comma or newline separated)</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. MAT612089N1A23456, MAT612089N1A78901"
                value={formData.chassisInput}
                onChange={(e) => setFormData({ ...formData, chassisInput: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono text-xs text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saving ? "Saving Model..." : "Save Model Envelope"}</span>
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase font-mono text-slate-400 bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-3">OEM / Model</th>
                <th className="py-2.5 px-3">Safe Voltage Range</th>
                <th className="py-2.5 px-3">Overload Cutoff</th>
                <th className="py-2.5 px-3">Thermal Max</th>
                <th className="py-2.5 px-3">Max RPM</th>
                <th className="py-2.5 px-3">Vibration</th>
                <th className="py-2.5 px-3">Linked Chassis</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {vehicleModels.map((m) => {
                const chassisCount = Array.isArray(m.assignedChassis) ? m.assignedChassis.length : 0;
                const vMin = m.voltage_min ?? m.voltage_sag_limit ?? 9.8;
                const vMax = m.voltage_max ?? 12.6;
                const iMax = m.current_max ?? m.current_overload_limit ?? 0.85;
                const tMax = m.temp_max ?? m.temp_critical_limit ?? 38.0;

                return (
                  <tr key={m.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900">
                      <div>{m.modelName}</div>
                      <div className="text-[10px] font-normal text-slate-400">{m.manufacturer}</div>
                    </td>
                    <td className="py-2.5 px-3 text-cyan-700 font-bold">{vMin}V – {vMax}V</td>
                    <td className="py-2.5 px-3 text-rose-600 font-bold">≥ {iMax} A</td>
                    <td className="py-2.5 px-3 text-amber-600 font-bold">≥ {tMax} °C</td>
                    <td className="py-2.5 px-3 text-slate-700 font-bold">{m.rpm_max ?? m.rpm_max_rated ?? 260} RPM</td>
                    <td className="py-2.5 px-3 text-purple-700 font-bold">≤ {m.vibration_max ?? m.vibration_limit ?? 2.2} m/s²</td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                        {chassisCount} VIN{chassisCount === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1 font-sans">
                        <button
                          onClick={() => handleEditClick(m)}
                          className="p-1 rounded text-slate-400 hover:text-cyan-600 hover:bg-cyan-50"
                          title="Edit Calibration"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteModel(m.id, m.modelName)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete Model"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}