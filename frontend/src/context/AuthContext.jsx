import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateEmail,
  updatePassword
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext();

const rawApiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const API_BASE = rawApiBase.replace(/\/$/, "");

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const generateUniqueId = (prefix) => {
    return `${prefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  };

  const signup = async (email, password, role = "user", extraData = {}) => {
    if (role === "user") {
      const chassisToCheck = (extraData.chassisNumber || "").trim().toUpperCase();
      if (!chassisToCheck) {
        throw new Error("Chassis Number (VIN) is required for registration.");
      }

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("chassisNumber", "==", chassisToCheck));
      const existingSnap = await getDocs(q);

      if (!existingSnap.empty) {
        throw new Error(
          `Chassis Number ${chassisToCheck} is already registered to another owner. Each vehicle must have a unique account.`
        );
      }
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    let profile = {};

    if (role === "admin") {
      profile = {
        uid: user.uid,
        userId: generateUniqueId("MFG"),
        email: user.email,
        companyName: extraData.companyName || extraData.organizationName || "VoltPulse Lab Rig",
        fullName: extraData.fullName || extraData.organizationName || "Fleet Administrator",
        divisionCode: extraData.divisionCode || "PLANT-BLR-01",
        phone: extraData.phone || "",
        role: "admin",
        createdAt: new Date().toISOString()
      };
    } else {
      const chassisClean = (extraData.chassisNumber || "MAT612089N1A23456").trim().toUpperCase();
      const assignedVehicleId = extraData.vehicleId || `VEH-${chassisClean.slice(-6) || "EV01"}`;

      profile = {
        uid: user.uid,
        userId: generateUniqueId("OWN"),
        email: user.email,
        fullName: extraData.fullName || "Vehicle Owner",
        phone: extraData.phone || "",
        role: "user",
        companyName: extraData.companyName || "VoltPulse Lab Rig",
        vehicleId: assignedVehicleId,
        vehicleModel: extraData.vehicleModel || "3S Hardware Testbench (12V L298N)",
        chassisNumber: chassisClean,
        createdAt: new Date().toISOString()
      };
    }

    await setDoc(doc(db, "users", user.uid), profile);
    setUserProfile(profile);
    setUserRole(role);
    return user;
  };

  const updateUserProfileData = async (updatedFields, newPassword = null) => {
    if (!currentUser) return;

    if (updatedFields.chassisNumber && userRole === "user") {
      const newChassis = updatedFields.chassisNumber.trim().toUpperCase();
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("chassisNumber", "==", newChassis));
      const snap = await getDocs(q);

      const isTakenByAnother = snap.docs.some((d) => d.id !== currentUser.uid);
      if (isTakenByAnother) {
        throw new Error(
          `Chassis ${newChassis} is already registered to another account.`
        );
      }
      updatedFields.chassisNumber = newChassis;
    }

    if (updatedFields.email && updatedFields.email !== currentUser.email) {
      await updateEmail(currentUser, updatedFields.email);
    }

    if (newPassword && newPassword.trim().length >= 6) {
      await updatePassword(currentUser, newPassword.trim());
    }

    const userDocRef = doc(db, "users", currentUser.uid);
    await updateDoc(userDocRef, updatedFields);
    setUserProfile((prev) => ({ ...prev, ...updatedFields }));

    if (userRole === "user") {
      try {
        await fetch(`${API_BASE}/api/session/bind`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userProfile?.userId || "OWN-DEFAULT",
            vehicleId: updatedFields.vehicleId || userProfile?.vehicleId || "VEH-DEFAULT",
            vehicleModel: updatedFields.vehicleModel || userProfile?.vehicleModel || "3S Hardware Testbench (12V L298N)",
            email: updatedFields.email || currentUser.email,
            fullName: updatedFields.fullName || userProfile?.fullName || "Vehicle Owner",
            chassisNumber: updatedFields.chassisNumber || userProfile?.chassisNumber || "MAT612089N1A23456"
          })
        });
      } catch (e) {
        console.error("Backend re-bind error:", e);
      }
    }
  };

  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    try {
      await fetch(`${API_BASE}/api/session/unbind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chassisNumber: userProfile?.chassisNumber || ""
        })
      });
    } catch (e) {
      console.error("Backend unbind error:", e);
    }
    setUserProfile(null);
    setUserRole(null);
    setCurrentUser(null);
    return signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserProfile(data);
          setUserRole(data.role || "user");
        } else {
          setUserRole("user");
        }
      } else {
        setUserProfile(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      userProfile, 
      userRole, 
      signup, 
      login, 
      logout, 
      updateUserProfileData,
      loading 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);