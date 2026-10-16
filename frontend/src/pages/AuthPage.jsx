// src/pages/AuthPage.jsx
import React, { useState, useEffect } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Zap, Mail, Lock, User, Phone, Cpu, Factory, CheckCircle2 } from "lucide-react";

export default function AuthPage({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  // All models from Firestore
  const [allModels, setAllModels] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Vehicle Details
  const [selectedCompany, setSelectedCompany] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [chassisMatchedNotice, setChassisMatchedNotice] = useState("");

  // Admin / Manufacturer Details
  const [companyName, setCompanyName] = useState("");

  // Load models from Firestore
  useEffect(() => {
    const loadModels = async () => {
      try {
        const snap = await getDocs(collection(db, "vehicle_models"));
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setAllModels(list);

        // Extract unique companies/manufacturers
        const companies = Array.from(new Set(list.map((m) => m.manufacturer || "Other"))).filter(Boolean);
        setAvailableCompanies(companies);

        if (companies.length > 0) {
          setSelectedCompany(companies[0]);
        }
      } catch (err) {
        console.error("Error loading models:", err);
      }
    };
    loadModels();
  }, []);

  // Update available models when selectedCompany changes
  const filteredModels = allModels.filter(
    (m) => (m.manufacturer || "").toLowerCase() === (selectedCompany || "").toLowerCase()
  );

  useEffect(() => {
    if (filteredModels.length > 0 && !filteredModels.some((m) => m.modelName === vehicleModel)) {
      setVehicleModel(filteredModels[0].modelName);
    }
  }, [selectedCompany, filteredModels]);

  // Chassis Number Auto-Detection Logic
  const handleChassisChange = (rawChassis) => {
    const cleanChassis = rawChassis.toUpperCase();
    setChassisNumber(cleanChassis);

    if (!cleanChassis.trim()) {
      setChassisMatchedNotice("");
      return;
    }

    // Search across all models to see if this chassis was pre-registered
    const matched = allModels.find(
      (m) => Array.isArray(m.assignedChassis) && m.assignedChassis.includes(cleanChassis)
    );

    if (matched) {
      setSelectedCompany(matched.manufacturer);
      setVehicleModel(matched.modelName);
      setChassisMatchedNotice(`✓ Auto-detected: ${matched.manufacturer} ${matched.modelName}`);
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
        // Registration
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const uid = cred.user.uid;

        // Find selected model envelope to attach to profile
        const matchedModel = allModels.find(
          (m) => m.modelName === vehicleModel && (m.manufacturer || "").toLowerCase() === selectedCompany.toLowerCase()
        ) || allModels[0];

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
          profileData.companyName = selectedCompany || "Tata Motors";
          profileData.vehicleModel = vehicleModel || (filteredModels[0]?.modelName ?? "EV Model");
          profileData.vehicleId = vehicleId.trim() || "KA-01-EV-0001";
          profileData.chassisNumber = chassisNumber.trim().toUpperCase() || "CHASSIS-DEMO-01";
          if (matchedModel) {
            profileData.calibration = {
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
            {isLogin ? "Sign in to access live telematics and vehicle telemetry" : "Register vehicle and link telemetry calibration"}
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
                  {/* Step 1: Chassis Number with Auto-Detection */}
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

                  {/* Step 2: Company Dropdown & Filtered Model Dropdown */}
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
                        {availableCompanies.length === 0 ? (
                          <option value="Tata Motors">Tata Motors</option>
                        ) : (
                          availableCompanies.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))
                        )}
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
                          <option value="">No models registered</option>
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