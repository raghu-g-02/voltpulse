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

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const generateUniqueId = (prefix) => {
    return `${prefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  };

  const signup = async (email, password, role = "user", extraData = {}) => {
    // 1. STRICT 1-TO-1 CHASSIS CHECK (For Vehicle Owners)
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
          `Chassis Number ${chassisToCheck} is already registered to another owner. Each vehicle can only be linked to one account.`
        );
      }
    }

    // 2. Create Firebase Auth Credentials
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    let profile = {};

    if (role === "admin") {
      profile = {
        uid: user.uid,
        userId: generateUniqueId("MFG"),
        email: user.email,
        organizationName: extraData.organizationName || extraData.fullName || "EV Powertrain Manufacturer",
        fullName: extraData.fullName || extraData.organizationName || "Fleet Administrator",
        divisionCode: extraData.divisionCode || "PLANT-BLR-01",
        phone: extraData.phone || "",
        role: "admin",
        createdAt: new Date().toISOString()
      };
    } else {
      const chassisClean = extraData.chassisNumber.trim().toUpperCase();
      const assignedVehicleId = `VEH-${chassisClean.slice(-6) || "EV01"}`;

      profile = {
        uid: user.uid,
        userId: generateUniqueId("OWN"),
        email: user.email,
        fullName: extraData.fullName || "Vehicle Owner",
        phone: extraData.phone || "",
        role: "user",
        vehicleId: assignedVehicleId,
        vehicleModel: extraData.vehicleModel || "Tata Nexon EV",
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

    // Check unique chassis constraint if user changes chassis number
    if (updatedFields.chassisNumber && userRole === "user") {
      const newChassis = updatedFields.chassisNumber.trim().toUpperCase();
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("chassisNumber", "==", newChassis));
      const snap = await getDocs(q);

      const isTakenByAnother = snap.docs.some((d) => d.id !== currentUser.uid);
      if (isTakenByAnother) {
        throw new Error(
          `Chassis ${newChassis} is already linked to another registered account. Cannot transfer ownership.`
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
        await fetch("http://localhost:8000/api/session/bind", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userProfile?.userId || "OWN-DEFAULT",
            vehicleId: updatedFields.vehicleId || userProfile?.vehicleId || "VEH-DEFAULT",
            vehicleModel: updatedFields.vehicleModel || userProfile?.vehicleModel || "Tata Nexon EV",
            email: updatedFields.email || currentUser.email,
            fullName: updatedFields.fullName || userProfile?.fullName || "Vehicle Owner",
            chassisNumber: updatedFields.chassisNumber || userProfile?.chassisNumber || ""
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
      await fetch("http://localhost:8000/api/session/unbind", { method: "POST" });
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