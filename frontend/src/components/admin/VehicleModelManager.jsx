// src/components/admin/VehicleModelManager.jsx
import React, { useState } from "react";
import { Sliders, Plus, Trash2, Edit3, Check, X, ShieldCheck } from "lucide-react";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

export default function VehicleModelManager({ vehicleModels, manufacturerName, onRefresh }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialForm = {
    modelName: "",
    manufacturer: manufacturerName || "Automotive OEM",
    voltage_nominal: 350.0,
    voltage_sag_limit: 300.0,
    current_nominal: 45.0,
    current_overload_limit: 220.0,
    temp_nominal: 30.0,
    temp_critical_limit: 62.0,
    rpm_max_rated: 12000,
  };

  const [formData, setFormData] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const handleEditClick = (model) => {
    setEditingId(model.id);
    setFormData({
      modelName: model.modelName || "",
      manufacturer: model.manufacturer || manufacturerName || "Automotive OEM",
      voltage_nominal: model.voltage_nominal ?? 350.0,
      voltage_sag_limit: model.voltage_sag_limit ?? 300.0,
      current_nominal: model.current_nominal ?? 45.0,
      current_overload_limit: model.current_overload_limit ?? 220.0,
      temp_nominal: model.temp_nominal ?? 30.0,
      temp_critical_limit: model.temp_critical_limit ?? 62.0,
      rpm_max_rated: model.rpm_max_rated ?? 12000,
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

    const payload = {
      id: docId,
      modelName: formData.modelName.trim(),
      manufacturer: formData.manufacturer || manufacturerName || "Automotive OEM",
      voltage_nominal: parseFloat(formData.voltage_nominal) || 5.0,
      voltage_sag_limit: parseFloat(formData.voltage_sag_limit) || 4.2,
      current_nominal: parseFloat(formData.current_nominal) || 0.25,
      current_overload_limit: parseFloat(formData.current_overload_limit) || 0.95,
      temp_nominal: parseFloat(formData.temp_nominal) || 27.0,
      temp_critical_limit: parseFloat(formData.temp_critical_limit) || 42.0,
      rpm_max_rated: parseFloat(formData.rpm_max_rated) || 250,
      updatedAt: Date.now(),
    };

    try {
      // 1. Save to Firestore collection vehicle_models
      await setDoc(doc(db, "vehicle_models", docId), payload, { merge: true });

      // 2. Sync with Python FastAPI backend
      await fetch(`${API_BASE}/api/models/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: docId, modelData: payload }),
      }).catch(() => {});

      handleCancel();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Failed to save vehicle model:", err);
      alert("Error saving vehicle model to database.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModel = async (modelId, name) => {
    const confirmDel = window.confirm(`Are you sure you want to delete vehicle model "${name}"?`);
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, "vehicle_models", modelId));
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Failed to delete model:", err);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-600" />
            Vehicle Models & Calibration Catalog
          </h2>
          <p className="text-xs text-slate-500">
            Define threshold envelopes per model variant. All registered vehicles under a model inherit these rules.
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
              {editingId ? `Edit Model: ${formData.modelName}` : "Register New Vehicle Model"}
            </span>
            <button type="button" onClick={handleCancel} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Model Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Nexon EV Max or 5V TT-Motor"
                value={formData.modelName}
                onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-cyan-500 font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Manufacturer</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Nominal Voltage (V)</label>
              <input
                type="number"
                step="0.1"
                required
                value={formData.voltage_nominal}
                onChange={(e) => setFormData({ ...formData, voltage_nominal: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-rose-500 uppercase block mb-1">Voltage Sag Limit (V)</label>
              <input
                type="number"
                step="0.1"
                required
                value={formData.voltage_sag_limit}
                onChange={(e) => setFormData({ ...formData, voltage_sag_limit: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-rose-700 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-rose-500 uppercase block mb-1">Current Overload Cutoff (A)</label>
              <input
                type="number"
                step="0.05"
                required
                value={formData.current_overload_limit}
                onChange={(e) => setFormData({ ...formData, current_overload_limit: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-rose-700 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-amber-500 uppercase block mb-1">Critical Max Temp (°C)</label>
              <input
                type="number"
                step="0.5"
                required
                value={formData.temp_critical_limit}
                onChange={(e) => setFormData({ ...formData, temp_critical_limit: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-amber-700 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Max Rated RPM</label>
              <input
                type="number"
                step="10"
                required
                value={formData.rpm_max_rated}
                onChange={(e) => setFormData({ ...formData, rpm_max_rated: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Nominal Idle Current (A)</label>
              <input
                type="number"
                step="0.05"
                value={formData.current_nominal}
                onChange={(e) => setFormData({ ...formData, current_nominal: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-slate-700 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Nominal Temp (°C)</label>
              <input
                type="number"
                step="0.5"
                value={formData.temp_nominal}
                onChange={(e) => setFormData({ ...formData, temp_nominal: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-slate-700 focus:outline-none focus:border-cyan-500"
              />
            </div>
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

      {vehicleModels.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          No vehicle models defined. Click "Add Vehicle Model" above to configure your first model.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase font-mono text-slate-400 bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-3">Model Variant</th>
                <th className="py-2.5 px-3">Manufacturer</th>
                <th className="py-2.5 px-3">Nominal Voltage</th>
                <th className="py-2.5 px-3">Sag Limit</th>
                <th className="py-2.5 px-3">Overload Limit</th>
                <th className="py-2.5 px-3">Max Temp</th>
                <th className="py-2.5 px-3">Max RPM</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {vehicleModels.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-3 font-sans font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
                    <span>{m.modelName}</span>
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-600">{m.manufacturer}</td>
                  <td className="py-2.5 px-3 text-cyan-700 font-bold">{m.voltage_nominal} V</td>
                  <td className="py-2.5 px-3 text-rose-600 font-bold">&le; {m.voltage_sag_limit} V</td>
                  <td className="py-2.5 px-3 text-rose-600 font-bold">&ge; {m.current_overload_limit} A</td>
                  <td className="py-2.5 px-3 text-amber-600 font-bold">&ge; {m.temp_critical_limit} °C</td>
                  <td className="py-2.5 px-3 text-slate-800">{m.rpm_max_rated} RPM</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1 font-sans">
                      <button
                        onClick={() => handleEditClick(m)}
                        className="p-1 rounded text-slate-400 hover:text-cyan-600 hover:bg-cyan-50"
                        title="Edit Model"
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}