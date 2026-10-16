// src/components/EditProfileModal.jsx
import React, { useState, useEffect } from "react";
import { doc, updateDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Car, X, Check, Cpu, Phone, User, CheckCircle2 } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

export default function EditProfileModal({ isOpen, onClose }) {
  const { currentUser, userProfile } = useAuth();
  const [allModels, setAllModels] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [chassisMatchedNotice, setChassisMatchedNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (userProfile) {
      setFullName(userProfile.fullName || "");
      setPhone(userProfile.phone || "");
      setSelectedCompany(userProfile.companyName || "Tata Motors");
      setVehicleModel(userProfile.vehicleModel || "");
      setVehicleId(userProfile.vehicleId || "");
      setChassisNumber(userProfile.chassisNumber || "");
    }

    const loadModels = async () => {
      try {
        const snap = await getDocs(collection(db, "vehicle_models"));
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setAllModels(list);

        const companies = Array.from(new Set(list.map((m) => m.manufacturer || "Other"))).filter(Boolean);
        setAvailableCompanies(companies);
      } catch (err) {
        console.error("Error loading models catalog:", err);
      }
    };
    loadModels();
  }, [isOpen, userProfile]);

  const filteredModels = allModels.filter(
    (m) => (m.manufacturer || "").toLowerCase() === (selectedCompany || "").toLowerCase()
  );

  const handleChassisChange = (rawChassis) => {
    const clean = rawChassis.toUpperCase();
    setChassisNumber(clean);

    if (!clean.trim()) {
      setChassisMatchedNotice("");
      return;
    }

    const matched = allModels.find(
      (m) => Array.isArray(m.assignedChassis) && m.assignedChassis.includes(clean)
    );

    if (matched) {
      setSelectedCompany(matched.manufacturer);
      setVehicleModel(matched.modelName);
      setChassisMatchedNotice(`✓ Auto-detected: ${matched.manufacturer} ${matched.modelName}`);
    } else {
      setChassisMatchedNotice("");
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);

    const matchedModel = allModels.find(
      (m) => m.modelName === vehicleModel && (m.manufacturer || "").toLowerCase() === selectedCompany.toLowerCase()
    ) || allModels[0];

    const updatedData = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      companyName: selectedCompany,
      vehicleModel: vehicleModel.trim(),
      vehicleId: vehicleId.trim(),
      chassisNumber: chassisNumber.trim().toUpperCase(),
    };

    if (matchedModel) {
      updatedData.calibration = {
        modelName: matchedModel.modelName,
        manufacturer: matchedModel.manufacturer,
        voltage_nominal: matchedModel.voltage_nominal,
        voltage_sag_limit: matchedModel.voltage_sag_limit,
        current_nominal: matchedModel.current_nominal,
        current_overload_limit: matchedModel.current_overload_limit,
        temp_nominal: matchedModel.temp_nominal,
        temp_critical_limit: matchedModel.temp_critical_limit,
        rpm_max_rated: matchedModel.rpm_max_rated,
      };
    }

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, updatedData);

      await fetch(`${API_BASE}/api/session/bind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          email: currentUser.email,
          ...updatedData,
        }),
      }).catch(() => {});

      setSaving(false);
      onClose();
      window.location.reload();
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Failed to update profile.");
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
              <h3 className="text-sm font-bold text-slate-900">Edit Vehicle & Company</h3>
              <p className="text-[11px] text-slate-400">Update your manufacturer, model, and chassis</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Owner Full Name</label>
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
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Phone Number</label>
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

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Chassis Number (VIN)</label>
            <div className="relative">
              <Cpu className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={chassisNumber}
                onChange={(e) => handleChassisChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            {chassisMatchedNotice && (
              <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{chassisMatchedNotice}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Vehicle Company</label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-cyan-500"
              >
                {availableCompanies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Vehicle Model</label>
              <select
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-cyan-800 focus:bg-white focus:outline-none focus:border-cyan-500"
              >
                {filteredModels.map((m) => (
                  <option key={m.id} value={m.modelName}>
                    {m.modelName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Plate / Vehicle ID</label>
            <input
              type="text"
              required
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}