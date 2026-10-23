// src/components/EditProfileModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import { doc, updateDoc, collection, getDocs } from "firebase/firestore";
import { ref, set, get } from "firebase/database";
import { db, rtdb } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Car, X, Check, Cpu, Phone, User, CheckCircle2 } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

export default function EditProfileModal({ isOpen, onClose }) {
  const { currentUser, userProfile } = useAuth();

  const [allModels, setAllModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [chassisNotice, setChassisNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchCatalog = async () => {
      setLoadingModels(true);
      try {
        const snap = await getDocs(collection(db, "vehicle_models"));
        const list = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            modelName: data.modelName || data.model || data.name || docSnap.id,
            manufacturer: data.manufacturer || data.companyName || "VoltPulse Lab Rig",
            voltage_nominal: data.voltage_nominal ?? 11.8,
            voltage_sag_limit: data.voltage_sag_limit ?? 9.8,
            current_nominal: data.current_nominal ?? 0.20,
            current_overload_limit: data.current_overload_limit ?? 0.85,
            temp_nominal: data.temp_nominal ?? 28.0,
            temp_critical_limit: data.temp_critical_limit ?? 38.0,
            rpm_max_rated: data.rpm_max_rated ?? 260,
            assignedChassis: Array.isArray(data.assignedChassis) ? data.assignedChassis : [],
            ...data
          });
        });

        setAllModels(list);

        if (userProfile) {
          setFullName(userProfile.fullName || "");
          setPhone(userProfile.phone || "");
          setVehicleId(userProfile.vehicleId || "");
          const currentChassis = (userProfile.chassisNumber || "").trim().toUpperCase();
          setChassisNumber(currentChassis);

          const matchedByChassis = list.find((m) =>
            Array.isArray(m.assignedChassis) &&
            m.assignedChassis.some((c) => String(c).trim().toUpperCase() === currentChassis)
          );

          if (matchedByChassis) {
            setSelectedCompany(matchedByChassis.manufacturer);
            setVehicleModel(matchedByChassis.modelName);
            setChassisNotice(`✓ Auto-detected: ${matchedByChassis.manufacturer} ${matchedByChassis.modelName}`);
          } else {
            const userComp = (userProfile.companyName || "").trim().toLowerCase();
            const matchedComp = list.find((m) => {
              const mComp = (m.manufacturer || "").trim().toLowerCase();
              return mComp === userComp || mComp.includes(userComp) || userComp.includes(mComp);
            });

            const resolvedCompany = matchedComp ? matchedComp.manufacturer : (list[0]?.manufacturer || "VoltPulse Lab Rig");
            setSelectedCompany(resolvedCompany);

            const companyModels = list.filter(
              (m) => (m.manufacturer || "").trim().toLowerCase() === resolvedCompany.trim().toLowerCase()
            );

            const matchedModel = companyModels.find(
              (m) => m.modelName?.trim().toLowerCase() === (userProfile.vehicleModel || "").trim().toLowerCase()
            );

            if (matchedModel) {
              setVehicleModel(matchedModel.modelName);
            } else if (companyModels.length > 0) {
              setVehicleModel(companyModels[0].modelName);
            } else if (list.length > 0) {
              setVehicleModel(list[0].modelName);
            }
          }
        }
      } catch (err) {
        console.error("Error loading models catalog from Firestore:", err);
      } finally {
        setLoadingModels(false);
      }
    };

    fetchCatalog();
  }, [isOpen, userProfile]);

  const availableCompanies = useMemo(() => {
    const compSet = new Set();
    allModels.forEach((m) => {
      if (m.manufacturer && m.manufacturer.trim()) {
        compSet.add(m.manufacturer.trim());
      }
    });
    const result = Array.from(compSet);
    return result.length > 0 ? result : ["VoltPulse Lab Rig"];
  }, [allModels]);

  const filteredModels = useMemo(() => {
    if (!selectedCompany) return allModels;
    const normSelected = selectedCompany.trim().toLowerCase();

    const matches = allModels.filter((m) => {
      const normM = (m.manufacturer || "").trim().toLowerCase();
      return normM === normSelected || normM.includes(normSelected) || normSelected.includes(normM);
    });

    return matches.length > 0 ? matches : allModels;
  }, [allModels, selectedCompany]);

  useEffect(() => {
    if (filteredModels.length > 0) {
      const exists = filteredModels.some(
        (m) => m.modelName?.trim().toLowerCase() === vehicleModel?.trim().toLowerCase()
      );
      if (!exists) {
        setVehicleModel(filteredModels[0].modelName);
      }
    }
  }, [selectedCompany, filteredModels]);

  const handleChassisChange = (rawChassis) => {
    const clean = rawChassis.toUpperCase().trim();
    setChassisNumber(clean);

    if (!clean) {
      setChassisNotice("");
      return;
    }

    const matched = allModels.find(
      (m) => Array.isArray(m.assignedChassis) &&
             m.assignedChassis.some((c) => String(c).trim().toUpperCase() === clean)
    );

    if (matched) {
      setSelectedCompany(matched.manufacturer);
      setVehicleModel(matched.modelName);
      setChassisNotice(`✓ Auto-detected: ${matched.manufacturer} ${matched.modelName}`);
    } else {
      setChassisNotice("");
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);

    const matchedModel = allModels.find(
      (m) =>
        m.modelName?.trim().toLowerCase() === vehicleModel?.trim().toLowerCase() &&
        (m.manufacturer || "").trim().toLowerCase() === selectedCompany?.trim().toLowerCase()
    ) || allModels.find((m) => m.modelName?.trim().toLowerCase() === vehicleModel?.trim().toLowerCase())
      || allModels[0];

    const calibrationPayload = matchedModel
      ? {
          modelName: matchedModel.modelName,
          manufacturer: matchedModel.manufacturer,
          voltage_nominal: parseFloat(matchedModel.voltage_nominal) || 11.8,
          voltage_sag_limit: parseFloat(matchedModel.voltage_sag_limit) || 9.8,
          current_nominal: parseFloat(matchedModel.current_nominal) || 0.20,
          current_overload_limit: parseFloat(matchedModel.current_overload_limit) || 0.85,
          temp_nominal: parseFloat(matchedModel.temp_nominal) || 28.0,
          temp_critical_limit: parseFloat(matchedModel.temp_critical_limit) || 38.0,
          rpm_max_rated: parseFloat(matchedModel.rpm_max_rated) || 260,
        }
      : null;

    const cleanChassis = chassisNumber.trim().toUpperCase();

    const updatedProfile = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      companyName: selectedCompany,
      vehicleModel: vehicleModel.trim(),
      vehicleId: vehicleId.trim(),
      chassisNumber: cleanChassis,
      ...(calibrationPayload && { calibration: calibrationPayload }),
    };

    try {
      // 1. Update Firestore user profile
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, updatedProfile);

      // 2. Provision new chassis node in Realtime Database at /vehicles/{chassis}/live
      const chassisRtdbRef = ref(rtdb, `vehicles/${cleanChassis}/live`);
      const snap = await get(chassisRtdbRef);
      if (!snap.exists()) {
        await set(chassisRtdbRef, {
          chassis: cleanChassis,
          Voltage: parseFloat(calibrationPayload?.voltage_nominal ?? 11.8),
          Current: parseFloat(calibrationPayload?.current_nominal ?? 0.20),
          Temperature: parseFloat(calibrationPayload?.temp_nominal ?? 28.0),
          motor_rpm: Math.round((calibrationPayload?.rpm_max_rated ?? 260) * 0.85),
          ambient_temp: 26.4,
          ambient_humidity: 52.0,
          vibration_x: 0.14,
          vibration_y: 0.09,
          vibration_z: 9.81,
          timestamp: Date.now()
        });
      }

      // 3. Sync updated session with the FastAPI backend
      await fetch(`${API_BASE}/api/session/bind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          email: currentUser.email,
          ...updatedProfile,
          model_envelope: calibrationPayload,
        }),
      }).catch((err) => console.error("Session rebind error:", err));

      setSaving(false);
      onClose();
      window.location.reload();
    } catch (err) {
      console.error("Error saving vehicle profile:", err);
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
              <p className="text-[11px] text-slate-400">Linked to 3S Testbench & Firestore Models</p>
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
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Contact Phone</label>
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
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{chassisNotice}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
                Company
              </label>
              <select
                disabled={loadingModels || availableCompanies.length === 0}
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
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
                Model Variant
              </label>
              <select
                disabled={loadingModels || filteredModels.length === 0}
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
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
              Vehicle Plate / ID
            </label>
            <input
              type="text"
              required
              placeholder="VEH-A23456"
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