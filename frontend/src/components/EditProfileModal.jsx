// src/components/EditProfileModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import { doc, updateDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Car, X, Check, Cpu, Phone, User, CheckCircle2, Factory } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

export default function EditProfileModal({ isOpen, onClose }) {
  const { currentUser, userProfile } = useAuth();

  const [allModels, setAllModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(true);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [chassisNotice, setChassisNotice] = useState("");
  const [saving, setSaving] = useState(false);

  // 1. Fetch live models catalog from Firestore whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchCatalog = async () => {
      setLoadingModels(true);
      try {
        const snap = await getDocs(collection(db, "vehicle_models"));
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setAllModels(list);

        // Populate initial profile values
        if (userProfile) {
          setFullName(userProfile.fullName || "");
          setPhone(userProfile.phone || "");
          setVehicleId(userProfile.vehicleId || "");
          setChassisNumber(userProfile.chassisNumber || "");

          const initialCompany = userProfile.companyName || (list[0]?.manufacturer ?? "Tata Motors");
          setSelectedCompany(initialCompany);

          // Find if user's current model exists under this company
          const currentModelExists = list.some(
            (m) =>
              m.modelName?.trim().toLowerCase() === userProfile.vehicleModel?.trim().toLowerCase() &&
              m.manufacturer?.trim().toLowerCase() === initialCompany?.trim().toLowerCase()
          );

          if (currentModelExists) {
            setVehicleModel(userProfile.vehicleModel);
          } else {
            // Default to the first model of that company
            const firstCompanyModel = list.find(
              (m) => m.manufacturer?.trim().toLowerCase() === initialCompany?.trim().toLowerCase()
            );
            setVehicleModel(firstCompanyModel?.modelName || list[0]?.modelName || "");
          }
        }
      } catch (err) {
        console.error("Error fetching vehicle models catalog:", err);
      } finally {
        setLoadingModels(false);
      }
    };

    fetchCatalog();
  }, [isOpen, userProfile]);

  // 2. Extract unique manufacturers from Firestore
  const availableCompanies = useMemo(() => {
    const set = new Set();
    allModels.forEach((m) => {
      if (m.manufacturer?.trim()) set.add(m.manufacturer.trim());
    });
    return Array.from(set);
  }, [allModels]);

  // 3. Filter models strictly by the selected company
  const filteredModels = useMemo(() => {
    if (!selectedCompany) return allModels;
    return allModels.filter(
      (m) => (m.manufacturer || "").trim().toLowerCase() === selectedCompany.trim().toLowerCase()
    );
  }, [allModels, selectedCompany]);

  // 4. Keep vehicleModel synchronized when company changes
  useEffect(() => {
    if (filteredModels.length > 0) {
      const match = filteredModels.find((m) => m.modelName === vehicleModel);
      if (!match) {
        setVehicleModel(filteredModels[0].modelName);
      }
    } else {
      setVehicleModel("");
    }
  }, [selectedCompany, filteredModels]);

  // 5. Auto-detect company & model if entered Chassis matches an OEM VIN
  const handleChassisChange = (rawChassis) => {
    const clean = rawChassis.toUpperCase();
    setChassisNumber(clean);

    if (!clean.trim()) {
      setChassisNotice("");
      return;
    }

    const matched = allModels.find(
      (m) => Array.isArray(m.assignedChassis) && m.assignedChassis.includes(clean)
    );

    if (matched) {
      setSelectedCompany(matched.manufacturer);
      setVehicleModel(matched.modelName);
      setChassisNotice(`Auto-detected: ${matched.manufacturer} ${matched.modelName}`);
    } else {
      setChassisNotice("");
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);

    // Resolve the full calibration envelope for the selected model
    const matchedModel = allModels.find(
      (m) =>
        m.modelName?.trim().toLowerCase() === vehicleModel?.trim().toLowerCase() &&
        (m.manufacturer || "").trim().toLowerCase() === selectedCompany.trim().toLowerCase()
    ) || allModels.find((m) => m.modelName === vehicleModel) || allModels[0];

    const calibrationPayload = matchedModel
      ? {
          modelName: matchedModel.modelName,
          manufacturer: matchedModel.manufacturer,
          voltage_nominal: parseFloat(matchedModel.voltage_nominal) || 5.0,
          voltage_sag_limit: parseFloat(matchedModel.voltage_sag_limit) || 4.2,
          current_nominal: parseFloat(matchedModel.current_nominal) || 0.25,
          current_overload_limit: parseFloat(matchedModel.current_overload_limit) || 0.95,
          temp_nominal: parseFloat(matchedModel.temp_nominal) || 27.0,
          temp_critical_limit: parseFloat(matchedModel.temp_critical_limit) || 42.0,
          rpm_max_rated: parseFloat(matchedModel.rpm_max_rated) || 250,
        }
      : null;

    const updatedProfile = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      companyName: selectedCompany,
      vehicleModel: vehicleModel.trim(),
      vehicleId: vehicleId.trim(),
      chassisNumber: chassisNumber.trim().toUpperCase(),
      ...(calibrationPayload && { calibration: calibrationPayload }),
    };

    try {
      // 1. Update Firestore user document
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, updatedProfile);

      // 2. Sync updated model calibration directly with FastAPI backend session
      await fetch(`${API_BASE}/api/session/bind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          email: currentUser.email,
          ...updatedProfile,
          model_envelope: calibrationPayload,
        }),
      }).catch((err) => console.error("Session re-bind failed:", err));

      setSaving(false);
      onClose();
      // Reload page so TelemetryContext re-attaches to the new chassis & calibration
      window.location.reload();
    } catch (err) {
      console.error("Error updating vehicle profile:", err);
      alert("Failed to update profile. Please verify your connection.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-xl space-y-5">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-50 text-cyan-600">
              <Car className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Edit Vehicle & Calibration Profile</h3>
              <p className="text-[11px] text-slate-400">Select model from manufacturer database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          {/* Owner Details */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
              Owner Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
              Contact Phone
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Chassis VIN with Smart OEM Pre-registration Match */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
              Chassis Number (VIN)
            </label>
            <div className="relative">
              <Cpu className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                placeholder="e.g. MAT612089N1A23456"
                value={chassisNumber}
                onChange={(e) => handleChassisChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            {chassisNotice && (
              <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{chassisNotice}</span>
              </div>
            )}
          </div>

          {/* Filtered Company and Model Dropdowns */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
                Vehicle Company
              </label>
              <div className="relative">
                <select
                  disabled={loadingModels || availableCompanies.length === 0}
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                >
                  {availableCompanies.length === 0 ? (
                    <option value="">No Companies</option>
                  ) : (
                    availableCompanies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
                Vehicle Model
              </label>
              <select
                disabled={loadingModels || filteredModels.length === 0}
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-cyan-800 focus:bg-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              >
                {filteredModels.length === 0 ? (
                  <option value="">No models for this company</option>
                ) : (
                  filteredModels.map((m) => (
                    <option key={m.id} value={m.modelName}>
                      {m.modelName}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
              Vehicle Plate / Identifier
            </label>
            <input
              type="text"
              required
              placeholder="KA-05-EV-1234"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || loadingModels}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? "Saving..." : "Save & Bind Calibration"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}