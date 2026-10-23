// src/pages/AboutDashboard.jsx
import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import EditProfileModal from "../components/EditProfileModal";
import { 
  User, Phone, Car, Hash, Mail, Lock, CheckCircle2, 
  ArrowLeft, Edit3, Building, Layers 
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AboutDashboard({ onBackToHome, onOpenConsole }) {
  const { userProfile, userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <Navbar 
          currentView="about" 
          onNavigate={(view) => {
            if (view === "home") onBackToHome();
            if (view === "console" || view === "cockpit" || view === "fleet" || view === "models") onOpenConsole();
          }} 
        />

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {isAdmin ? "Manufacturer Organization Settings" : "Vehicle Profile & Account Details"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdmin 
                ? "Enterprise plant credentials, corporate contacts, and telemetry bindings." 
                : "Vehicle specifications and contact details linked to your telemetry account."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
            <button
              onClick={onBackToHome}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* Profile Details Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className={`p-3 rounded-2xl ${isAdmin ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-cyan-50 text-cyan-600 border border-cyan-100"}`}>
                {isAdmin ? <Building className="w-6 h-6" /> : <Car className="w-6 h-6" />}
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {isAdmin ? (userProfile?.companyName || "VoltPulse Lab Rig") : (userProfile?.vehicleModel || "3S Hardware Testbench")}
                </h3>
                <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                  isAdmin ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                }`}>
                  {userProfile?.userId || "OWN-ID"}
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
                    <span>{userProfile?.companyName || "VoltPulse Lab Rig"}</span>
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
                    <span>{userProfile?.fullName || "Raghu"}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-semibold block uppercase">Vehicle Model</span>
                  <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                    <Car className="w-4 h-4 text-slate-400" />
                    <span>{userProfile?.vehicleModel || "3S Hardware Testbench (12V L298N)"}</span>
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
                    <span>{userProfile?.vehicleId || "VEH-A23456"}</span>
                  </div>
                </div>
              </>
            )}

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-400 font-semibold block uppercase">Contact Phone</span>
              <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{userProfile?.phone || "+91 9187654320"}</span>
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
                <span>•••••••••••• (Encrypted — click "Edit Details" above to change profile parameters)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal linking directly to Firestore Vehicle Models */}
      <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
    </div>
  );
}