// frontend/src/pages/AuthPage.jsx
import React, { useState, useEffect } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";
import { ref, set, get } from "firebase/database";
import { auth, db, rtdb } from "../firebase";
import { Zap, Mail, Lock, User, Phone, Cpu, Factory, CheckCircle2 } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

export default function AuthPage({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const [allModels, setAllModels] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Vehicle Details
  const [selectedCompany, setSelectedCompany] = useState("Tata Motors");
  const [vehicleModel, setVehicleModel] = useState("Nexon EV");
  const [vehicleId, setVehicleId] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [chassisMatchedNotice, setChassisMatchedNotice] = useState("");

  // Admin / Manufacturer Details
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    const loadModels = async () => {
      try {
        const snap = await getDocs(collection(db, "vehicle_models"));
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setAllModels(list);

        const companies = Array.from(new Set(list.map((m) => m.manufacturer || "Tata Motors"))).filter(Boolean);
        setAvailableCompanies(companies.length > 0 ? companies : ["Tata Motors"]);

        if (companies.length > 0) {
          setSelectedCompany(companies[0]);
        }
      } catch (err) {
        console.error("Error loading models from Firestore:", err);
      }
    };
    loadModels();
  }, []);

  const filteredModels = allModels.filter(
    (m) => (m.manufacturer || "").toLowerCase() === (selectedCompany || "").toLowerCase()
  );

  useEffect(() => {
    if (filteredModels.length > 0 && !filteredModels.some((m) => m.modelName === vehicleModel)) {
      setVehicleModel(filteredModels[0].modelName);
    }
  }, [selectedCompany, filteredModels]);

  const handleChassisChange = (rawChassis) => {
    const cleanChassis = rawChassis.toUpperCase().trim();
    setChassisNumber(cleanChassis);

    if (!cleanChassis) {
      setChassisMatchedNotice("");
      return;
    }

    const matched = allModels.find(
      (m) => Array.isArray(m.assignedChassis) && 
             m.assignedChassis.some((c) => String(c).trim().toUpperCase() === cleanChassis)
    );

    if (matched) {
      setSelectedCompany(matched.manufacturer);
      setVehicleModel(matched.modelName);
      setChassisMatchedNotice(`✓ Auto-detected OEM Model: ${matched.manufacturer} ${matched.modelName}`);
    } else {
      setChassisMatchedNotice("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const userDoc = await getDoc(doc(db, "users", cred.user.uid));
        if (userDoc.exists()) {
          onLoginSuccess(userDoc.data());
        } else {
          onLoginSuccess({ uid: cred.user.uid, email: cred.user.email, role: "user" });
        }
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const uid = cred.user.uid;

        const cleanChassis = chassisNumber.trim().toUpperCase() || "MAT612089N1A23456";

        // Auto-match to Admin-defined model in vehicle_models
        const matchedModel = allModels.find(
          (m) => Array.isArray(m.assignedChassis) &&
                 m.assignedChassis.some((c) => String(c).trim().toUpperCase() === cleanChassis)
        ) || allModels.find(
          (m) => m.modelName === vehicleModel && (m.manufacturer || "").toLowerCase() === selectedCompany.toLowerCase()
        ) || allModels.find((m) => m.modelName === vehicleModel) || allModels[0];

        const calibrationPayload = matchedModel ? {
          modelName: matchedModel.modelName || "Nexon EV",
          manufacturer: matchedModel.manufacturer || "Tata Motors",
          voltage_min: parseFloat(matchedModel.voltage_min ?? matchedModel.voltage_sag_limit ?? 9.8),
          voltage_nominal: parseFloat(matchedModel.voltage_nominal ?? 11.8),
          voltage_max: parseFloat(matchedModel.voltage_max ?? 12.6),
          voltage_sag_limit: parseFloat(matchedModel.voltage_min ?? matchedModel.voltage_sag_limit ?? 9.8),
          current_nominal: parseFloat(matchedModel.current_nominal ?? 0.20),
          current_max: parseFloat(matchedModel.current_max ?? matchedModel.current_overload_limit ?? 0.85),
          current_overload_limit: parseFloat(matchedModel.current_max ?? matchedModel.current_overload_limit ?? 0.85),
          temp_nominal: parseFloat(matchedModel.temp_nominal ?? 28.0),
          temp_max: parseFloat(matchedModel.temp_max ?? matchedModel.temp_critical_limit ?? 38.0),
          temp_critical_limit: parseFloat(matchedModel.temp_max ?? matchedModel.temp_critical_limit ?? 38.0),
          rpm_min: parseFloat(matchedModel.rpm_min ?? 30),
          rpm_max: parseFloat(matchedModel.rpm_max ?? matchedModel.rpm_max_rated ?? 260),
          rpm_max_rated: parseFloat(matchedModel.rpm_max ?? matchedModel.rpm_max_rated ?? 260),
          vibration_max: parseFloat(matchedModel.vibration_max ?? matchedModel.vibration_limit ?? 2.2),
          vibration_limit: parseFloat(matchedModel.vibration_max ?? matchedModel.vibration_limit ?? 2.2),
        } : null;

        const profileData = {
          uid,
          email: email.trim(),
          fullName: fullName.trim(),
          phone: phone.trim(),
          role,
          createdAt: Date.now(),
        };

        if (role === "admin") {
          profileData.companyName = companyName.trim() || "Tata Motors";
          profileData.adminRole = "OEM Engineer / Admin";
        } else {
          profileData.companyName = matchedModel?.manufacturer || selectedCompany || "Tata Motors";
          profileData.vehicleModel = matchedModel?.modelName || vehicleModel || "Nexon EV";
          profileData.vehicleId = vehicleId.trim() || `VEH-${cleanChassis.slice(-6) || "EV01"}`;
          profileData.chassisNumber = cleanChassis;
          profileData.calibration = calibrationPayload;

          // PROVISION AT THE EXACT PATH EXPECTED BY ESP32: /vehicles/{chassis}/live
          const chassisRtdbRef = ref(rtdb, `vehicles/${cleanChassis}/live`);
          const rtdbSnap = await get(chassisRtdbRef);
          if (!rtdbSnap.exists()) {
            await set(chassisRtdbRef, {
              chassis: cleanChassis,
              Voltage: parseFloat(calibrationPayload?.voltage_nominal ?? 11.8),
              Current: parseFloat(calibrationPayload?.current_nominal ?? 0.20),
              Temperature: parseFloat(calibrationPayload?.temp_nominal ?? 28.0),
              motor_rpm: Math.round((calibrationPayload?.rpm_max ?? 260) * 0.85),
              ambient_temp: 26.4,
              ambient_humidity: 52.0,
              vibration_x: 0.05,
              vibration_y: 0.08,
              vibration_z: 9.81,
              timestamp: Date.now()
            });
          }

          // Pre-bind session to backend engine
          await fetch(`${API_BASE}/api/session/bind`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: uid,
              vehicleId: profileData.vehicleId,
              vehicleModel: profileData.vehicleModel,
              companyName: profileData.companyName,
              email: profileData.email,
              fullName: profileData.fullName,
              chassisNumber: cleanChassis,
              calibration: calibrationPayload,
            }),
          }).catch((err) => console.error("Initial session bind error:", err));
        }

        await setDoc(doc(db, "users", uid), profileData);
        onLoginSuccess(profileData);
      }
    } catch (err) {
      console.error("Authentication error:", err);
      setErrorMsg(err.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMsg("Please enter your email address to receive password reset instructions.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMsg("Password reset email sent! Please check your inbox.");
    } catch (err) {
      setErrorMsg(err.message.replace("Firebase: ", ""));
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 text-cyan-600 mb-2">
            <Zap className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">VoltPulse AI</h1>
          <p className="text-xs text-slate-500">
            {isLogin ? "Sign in to access live telematics cockpit" : "Register vehicle and auto-provision telematics"}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setRole("user")}
                className={`py-2 rounded-lg transition ${role === "user" ? "bg-white text-cyan-700 shadow-sm" : ""}`}
              >
                Vehicle Owner
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`py-2 rounded-lg transition ${role === "admin" ? "bg-white text-cyan-700 shadow-sm" : ""}`}
              >
                OEM Manufacturer
              </button>
            </div>
          )}

          {!isLogin && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="Raghu B"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500"
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
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {role === "admin" ? (
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Company / OEM Name</label>
                  <div className="relative">
                    <Factory className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tata Motors"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 font-bold"
                    />
                  </div>
                </div>
              ) : (
                <>
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
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:bg-white focus:outline-none focus:border-cyan-500"
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
                      <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
                        Vehicle Company
                      </label>
                      <select
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-cyan-500"
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
                        Vehicle Model
                      </label>
                      <select
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-cyan-800 focus:bg-white focus:outline-none focus:border-cyan-500"
                      >
                        {filteredModels.length === 0 ? (
                          <option value="Nexon EV">Nexon EV</option>
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
                    <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Plate Number / Vehicle ID</label>
                    <input
                      type="text"
                      required
                      placeholder="KA-05-EV-1234"
                      value={vehicleId}
                      onChange={(e) => setVehicleId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Email Address (Gmail)</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                placeholder="owner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/20 disabled:opacity-50"
          >
            {loading ? "Authenticating..." : isLogin ? "Sign In to Cockpit" : "Complete Registration"}
          </button>
        </form>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setErrorMsg(""); setInfoMsg(""); }}
            className="text-cyan-700 hover:underline font-semibold"
          >
            {isLogin ? "Need an account? Register" : "Already registered? Sign in"}
          </button>

          {isLogin && (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-slate-400 hover:text-slate-600"
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}