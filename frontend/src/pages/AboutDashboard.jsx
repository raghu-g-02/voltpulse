// src/pages/AboutDashboard.jsx
import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { 
  User, Phone, Car, Hash, Mail, Lock, CheckCircle2, 
  Save, ArrowLeft, Edit3, X, AlertCircle, Building, Layers 
} from "lucide-react";
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

export default function AboutDashboard({ onBackToHome, onOpenConsole }) {
  const { userProfile, updateUserProfileData, userRole } = useAuth();
  const isAdmin = userRole === "admin";

  const [isEditing, setIsEditing] = useState(false);

  // Common States
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Owner States
  const [fullName, setFullName] = useState("");
  const [vehicleModel, setVehicleModel] = useState(EV_MODELS[0]);
  const [chassisNumber, setChassisNumber] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  // Admin States
  const [organizationName, setOrganizationName] = useState("");
  const [divisionCode, setDivisionCode] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    if (userProfile) {
      setEmail(userProfile.email || "");
      setPhone(userProfile.phone || "");
      setFullName(userProfile.fullName || "");
      setVehicleModel(userProfile.vehicleModel || EV_MODELS[0]);
      setChassisNumber(userProfile.chassisNumber || "");
      setVehicleId(userProfile.vehicleId || "");
      setOrganizationName(userProfile.organizationName || userProfile.fullName || "");
      setDivisionCode(userProfile.divisionCode || "PLANT-BLR-01");
      setNewPassword("");
    }
  }, [userProfile]);

  const handleCancel = () => {
    if (userProfile) {
      setEmail(userProfile.email || "");
      setPhone(userProfile.phone || "");
      setFullName(userProfile.fullName || "");
      setVehicleModel(userProfile.vehicleModel || EV_MODELS[0]);
      setChassisNumber(userProfile.chassisNumber || "");
      setVehicleId(userProfile.vehicleId || "");
      setOrganizationName(userProfile.organizationName || userProfile.fullName || "");
      setDivisionCode(userProfile.divisionCode || "PLANT-BLR-01");
      setNewPassword("");
    }
    setIsEditing(false);
    setStatusMessage({ text: "", type: "" });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage({ text: "", type: "" });

    try {
      if (isAdmin) {
        await updateUserProfileData({
          organizationName: organizationName.trim(),
          fullName: organizationName.trim(),
          divisionCode: divisionCode.trim().toUpperCase(),
          phone: phone.trim(),
          email: email.trim()
        }, newPassword);
      } else {
        await updateUserProfileData({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          vehicleModel: vehicleModel,
          chassisNumber: chassisNumber.trim().toUpperCase(),
          vehicleId: vehicleId.trim().toUpperCase()
        }, newPassword);
      }

      setStatusMessage({ 
        text: "Account and profile details updated successfully!", 
        type: "success" 
      });
      setIsEditing(false);
      setNewPassword("");
      setTimeout(() => setStatusMessage({ text: "", type: "" }), 5000);
    } catch (err) {
      console.error("Profile update error:", err);
      setStatusMessage({ 
        text: err.message.replace("Firebase: ", "") || "Failed to update profile. Please try again.", 
        type: "error" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <Navbar currentView="about" onNavigate={(view) => {
          if (view === "home") onBackToHome();
          if (view === "console") onOpenConsole();
        }} />

        {/* Page Action Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {isAdmin ? "Manufacturer Organization Settings" : "Vehicle Profile & Account Details"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdmin 
                ? "Manage your enterprise plant credentials, corporate contacts, and security." 
                : "View and edit all vehicle specifications and contact details linked to your account."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit All Details</span>
              </button>
            ) : (
              <button
                onClick={handleCancel}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
            <button
              onClick={onBackToHome}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage.text && (
          <div className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 shadow-sm ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}>
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* MAIN PROFILE CARD */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          {!isEditing ? (
            /* ================= VIEW MODE ================= */
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className={`p-3 rounded-2xl ${isAdmin ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-cyan-50 text-cyan-600 border border-cyan-100"}`}>
                    {isAdmin ? <Building className="w-6 h-6" /> : <Car className="w-6 h-6" />}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {isAdmin ? (userProfile?.organizationName || "EV Powertrain Manufacturer") : (userProfile?.vehicleModel || "Tata Nexon EV")}
                    </h3>
                    <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                      isAdmin ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                    }`}>
                      {userProfile?.userId || "N/A"}
                    </span>
                  </div>
                </div>
                <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${
                  isAdmin ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}>
                  {isAdmin ? "Manufacturer Admin" : "Vehicle Owner Connected"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isAdmin ? (
                  <>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[11px] text-slate-400 font-semibold block uppercase">Organization Name</span>
                      <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                        <Building className="w-4 h-4 text-slate-400" />
                        <span>{userProfile?.organizationName || "EV Powertrain Division"}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[11px] text-slate-400 font-semibold block uppercase">Plant / Division Code</span>
                      <div className="text-sm font-mono font-bold text-slate-800 mt-1 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-400" />
                        <span>{userProfile?.divisionCode || "PLANT-BLR-01"}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[11px] text-slate-400 font-semibold block uppercase">Owner Full Name</span>
                      <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>{userProfile?.fullName || "Not Specified"}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[11px] text-slate-400 font-semibold block uppercase">EV Model</span>
                      <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                        <Car className="w-4 h-4 text-slate-400" />
                        <span>{userProfile?.vehicleModel || "Tata Nexon EV"}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[11px] text-slate-400 font-semibold block uppercase">Chassis Number (VIN)</span>
                      <div className="text-sm font-mono font-bold text-slate-800 mt-1 flex items-center gap-2">
                        <Hash className="w-4 h-4 text-slate-400" />
                        <span>{userProfile?.chassisNumber || "MAT612089N1A23456"}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[11px] text-slate-400 font-semibold block uppercase">Vehicle Plate / ID</span>
                      <div className="text-sm font-mono font-bold text-slate-800 mt-1 flex items-center gap-2">
                        <Hash className="w-4 h-4 text-slate-400" />
                        <span>{userProfile?.vehicleId || "VEH-DEFAULT"}</span>
                      </div>
                    </div>
                  </>
                )}

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-semibold block uppercase">Contact Phone</span>
                  <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{userProfile?.phone || "Not Provided"}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-semibold block uppercase">Registered Email</span>
                  <div className="text-sm font-medium text-slate-800 mt-1 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>{userProfile?.email || "Not Provided"}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2">
                  <span className="text-[11px] text-slate-400 font-semibold block uppercase">Security & Password</span>
                  <div className="text-sm font-medium text-slate-700 mt-1 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>•••••••••••• (Encrypted — click "Edit All Details" to update)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================= EDIT MODE ================= */
            <form onSubmit={handleSave} className="space-y-5">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">
                  {isAdmin ? "Edit Manufacturer Organization Information" : "Edit Vehicle Registration Details"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update any field below. Changes will sync across the cloud and your session.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isAdmin ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Organization / OEM Name</label>
                      <div className="relative">
                        <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          value={organizationName}
                          onChange={(e) => setOrganizationName(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500 transition font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Plant / Division Code</label>
                      <div className="relative">
                        <Layers className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          value={divisionCode}
                          onChange={(e) => setDivisionCode(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 uppercase focus:bg-white focus:outline-none focus:border-rose-500 transition font-bold"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Owner Full Name</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">EV Model</label>
                      <div className="relative">
                        <Car className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <select
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition appearance-none font-medium"
                        >
                          {EV_MODELS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Chassis Number (VIN)</label>
                      <div className="relative">
                        <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          value={chassisNumber}
                          onChange={(e) => setChassisNumber(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition uppercase font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Plate / ID</label>
                      <div className="relative">
                        <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          value={vehicleId}
                          onChange={(e) => setVehicleId(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition uppercase font-bold"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isAdmin ? "Corporate Desk Phone" : "Contact Phone Number"}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition font-medium"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Change Password <span className="font-normal text-slate-400">(leave blank to keep current password)</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter at least 6 characters to change password"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-5 py-2 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition shadow-md flex items-center gap-1.5 disabled:opacity-50 ${
                    isAdmin ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20" : "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20"
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? "Saving..." : "Save All Changes"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}