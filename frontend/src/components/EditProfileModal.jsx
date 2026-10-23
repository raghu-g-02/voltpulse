// src/components/EditProfileModal.jsx
import React, { useState, useEffect } from "react";
import { doc, updateDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Car, X, Check, Cpu, Phone, User, CheckCircle2 } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

export default function EditProfileModal({ isOpen, onClose }) {
  const { currentUser, userProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("Tata Motors");
  const [vehicleModel, setVehicleModel] = useState("Nexon EV");

  const [allModels, setAllModels] = useState([]);
  const [chassisNotice, setChassisNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadCatalog = async () => {
      try {
        const snap = await getDocs(collection(db, "vehicle_models"));
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setAllModels(list);

        if (userProfile) {
          setFullName(userProfile.fullName || "");
          setPhone(userProfile.phone || "");
          setVehicleId(userProfile.vehicleId || "");
          const cleanChassis = (userProfile.chassisNumber || "MAT612089N1A23456").toUpperCase().trim();
          setChassisNumber(cleanChassis);

          // Check if this chassis belongs to an existing model in the catalog
          const matched = list.find((m) =>
            Array.isArray(m.assignedChassis) &&
            m.assignedChassis.some((c) => String(c).trim().toUpperCase() === cleanChassis)
          );

          if (matched) {
            setSelectedCompany(matched.manufacturer);
            setVehicleModel(matched.modelName);
            setChassisNotice(`✓ Linked to OEM Model: ${matched.manufacturer} ${matched.modelName}`);
          } else {
            setSelectedCompany(userProfile.companyName || "Tata Motors");
            setVehicleModel(userProfile.vehicleModel || "Nexon EV");
          }
        }
      } catch (e) {
        console.error("Error loading models:", e);
      }
    };

    loadCatalog();
  }, [isOpen, userProfile]);

  const handleChassisChange = (raw) => {
    const clean = raw.toUpperCase().trim();
    setChassisNumber(clean);

    if (!clean) {
      setChassisNotice("");
      return;
    }

    const matched = allModels.find((m) =>
      Array.isArray(m.assignedChassis) &&
      m.assignedChassis.some((c) => String(c).trim().toUpperCase() === clean)
    );

    if (matched) {
      setSelectedCompany(matched.manufacturer);
      setVehicleModel(matched.modelName);
      setChassisNotice(`✓ Auto-detected OEM Model: ${matched.manufacturer} ${matched.modelName}`);
    } else {
      setChassisNotice("");
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);

    const cleanChassis = chassisNumber.trim().toUpperCase();

    // Find the latest Admin calibration for this vehicle model
    const matchedModel = allModels.find((m) =>
      Array.isArray(m.assignedChassis) &&
      m.assignedChassis.some((c) => String(c).trim().toUpperCase() === cleanChassis)
    ) || allModels.find((m) => m.modelName?.toLowerCase() === vehicleModel.toLowerCase()) || allModels[0];

    const updatedProfile = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      companyName: selectedCompany,
      vehicleModel: vehicleModel.trim(),
      vehicleId: vehicleId.trim(),
      chassisNumber: cleanChassis,
      calibration: matchedModel || null,
    };

    try {
      // 1. Update user record in Firestore
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, updatedProfile);

      // 2. Synchronize session with FastAPI backend
      await fetch(`${API_BASE}/api/session/bind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          email: currentUser.email,
          ...updatedProfile,
          calibration: matchedModel || null,
        }),
      }).catch((err) => console.error("Session rebind error:", err));

      setSaving(false);
      onClose();
      window.location.reload();
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Failed to update profile. Please verify your connection.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-50 text-cyan-600">
              <Car className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Vehicle & Driver Profile</h3>
              <p className="text-[11px] text-slate-400">Powertrain calibration is governed by OEM Admin</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Driver Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Contact Phone</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
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
                placeholder="e.g. MAT612089N1A23456"
                value={chassisNumber}
                onChange={(e) => handleChassisChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
              />
            </div>
            {chassisNotice && (
              <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{chassisNotice}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Vehicle Model</label>
              <input
                type="text"
                readOnly
                value={vehicleModel}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-bold text-cyan-800 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Plate / Vehicle ID</label>
              <input
                type="text"
                required
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? "Saving..." : "Save Details"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}