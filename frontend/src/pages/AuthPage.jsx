// src/pages/AuthPage.jsx
import React, { useState } from "react";
import { Zap, ShieldCheck, User, ArrowLeft, Car, Phone, Hash, Mail, Lock, Building, Layers } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const EV_MODELS = [
  "Tata Nexon EV",
  "Tata Punch EV",
  "Mahindra XUV400 EV",
  "MG ZS EV",
  "Hyundai Ioniq 5",
  "BYD Atto 3",
  "Custom Powertrain Testbench"
];

export default function AuthPage({ onBackToHome }) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState("user");

  // Shared Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  // Owner-Specific Fields
  const [fullName, setFullName] = useState("");
  const [vehicleModel, setVehicleModel] = useState(EV_MODELS[0]);
  const [chassisNumber, setChassisNumber] = useState("");

  // Manufacturer-Specific Fields
  const [organizationName, setOrganizationName] = useState("");
  const [divisionCode, setDivisionCode] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (role === "user") {
          if (!chassisNumber.trim()) {
            throw new Error("Chassis Number (VIN) is mandatory for vehicle registration.");
          }
          await signup(email, password, "user", {
            fullName: fullName.trim(),
            phone: phone.trim(),
            vehicleModel: vehicleModel,
            chassisNumber: chassisNumber.trim().toUpperCase(),
            vehicleId: `VEH-${chassisNumber.trim().slice(-6).toUpperCase() || "EV01"}`
          });
        } else {
          // Manufacturer Signup
          if (!organizationName.trim()) {
            throw new Error("Manufacturer Organization Name is required.");
          }
          await signup(email, password, "admin", {
            organizationName: organizationName.trim(),
            fullName: fullName.trim() || organizationName.trim(),
            divisionCode: divisionCode.trim().toUpperCase() || "PLANT-BLR-01",
            phone: phone.trim()
          });
        }
      }
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-xl relative">
        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="absolute top-6 left-6 text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>
        )}

        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center gap-2 mb-6 mt-2">
          <span className="p-3 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-600 shadow-sm">
            <Zap className="w-6 h-6" />
          </span>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">VoltPulse AI</h1>
          <p className="text-xs text-slate-500 font-medium">
            {isLogin 
              ? "Sign in to access EV telematics" 
              : role === "admin" 
                ? "Register Manufacturer Fleet Console" 
                : "Register and link your electric vehicle"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Role Selector in Signup Mode */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Category</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("user")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                    role === "user"
                      ? "bg-cyan-50 border-cyan-500 text-cyan-700 shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Vehicle Owner</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                    role === "admin"
                      ? "bg-rose-50 border-rose-500 text-rose-700 shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Manufacturer</span>
                </button>
              </div>
            </div>
          )}

          {/* VEHICLE OWNER FIELDS */}
          {!isLogin && role === "user" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>
            </div>
          )}

          {/* MANUFACTURER ENTERPRISE FIELDS */}
          {!isLogin && role === "admin" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization / OEM Name</label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500 transition"
                    placeholder="e.g. Tata Motors EV Powertrain Division"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Plant / Engineering Division Code</label>
                <div className="relative">
                  <Layers className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={divisionCode}
                    onChange={(e) => setDivisionCode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 uppercase focus:bg-white focus:outline-none focus:border-rose-500 transition"
                    placeholder="e.g. PLANT-BLR-01"
                  />
                </div>
              </div>
            </>
          )}

          {/* EMAIL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {role === "admin" && !isLogin ? "Corporate Official Email" : "Email Address"}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition"
                placeholder={role === "admin" ? "oem.fleet@voltpulse.com" : "owner@example.com"}
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* ADDITIONAL FIELDS FOR OWNER */}
          {!isLogin && role === "user" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select EV Model</label>
                <div className="relative">
                  <Car className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <select
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition appearance-none"
                  >
                    {EV_MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chassis Number (VIN)</label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={chassisNumber}
                    onChange={(e) => setChassisNumber(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition uppercase"
                    placeholder="e.g. MAT612089N1A23456"
                  />
                </div>
              </div>
            </>
          )}

          {/* ADDITIONAL PHONE FOR ADMIN */}
          {!isLogin && role === "admin" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Desk / Direct Phone</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500 transition"
                  placeholder="+91 80 2345 6789"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white transition shadow-md disabled:opacity-50 mt-3 ${
              role === "admin" && !isLogin
                ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
                : "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20"
            }`}
          >
            {loading ? "Processing..." : isLogin ? "Sign In" : role === "admin" ? "Register Manufacturer Account" : "Register Vehicle & Profile"}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-slate-500">
          {isLogin ? "Need to register? " : "Already registered? "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-cyan-600 hover:underline font-bold"
          >
            {isLogin ? "Register here" : "Sign in here"}
          </button>
        </div>
      </div>
    </div>
  );
}