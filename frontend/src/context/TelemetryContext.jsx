import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { collection, doc, setDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

const FAULT_NAMES = {
  1: "Motor Transmission Overload",
  2: "Inverter Voltage Sag",
  3: "Battery Thermal Overheat",
};

const formatEVDate = (d) => {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatEVTime = (d) => {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const defaultContextValue = {
  telemetry: {
    Voltage: 0.0,
    Current: 0.0,
    motor_rpm: 0.0,
    Temperature: 0.0,
    ambient_temp: 25.0,
    ambient_humidity: 50.0,
    vibration_x: 0.05,
    vibration_y: 0.08,
    vibration_z: 9.81
  },
  agentResult: null,
  source: "STANDBY",
  history: [],
  faultHistory: [],
  telemetryLogs: [],
  isSimulating: false,
  triggerSimulation: () => {},
  isVoiceMuted: true,
  toggleVoiceMute: () => {},
  speakText: () => {}
};

const TelemetryContext = createContext(defaultContextValue);

const rawApiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const API_BASE = rawApiBase.replace(/\/$/, "");

export function TelemetryProvider({ children }) {
  const { userProfile, currentUser, userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const userChassis = (userProfile?.chassisNumber || "").trim().toUpperCase();

  const [telemetry, setTelemetry] = useState(defaultContextValue.telemetry);
  const [agentResult, setAgentResult] = useState(null);
  const [source, setSource] = useState("STANDBY");
  const [history, setHistory] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [faultHistory, setFaultHistory] = useState([]);
  const [telemetryLogs, setTelemetryLogs] = useState([]);

  const [isVoiceMuted, setIsVoiceMuted] = useState(() => {
    try {
      return localStorage.getItem("voltpulse_voice_muted") === "true";
    } catch (e) {
      return false;
    }
  });

  const latestTelemetryRef = useRef(telemetry);
  const latestAgentResultRef = useRef(agentResult);

  useEffect(() => {
    latestTelemetryRef.current = telemetry;
  }, [telemetry]);

  useEffect(() => {
    latestAgentResultRef.current = agentResult;
  }, [agentResult]);

  const lastSpokenSignatureRef = useRef(null);
  const hasSpokenInitialGreetingRef = useRef(false);
  const lastProcessedSignatureRef = useRef(null);

  const toggleVoiceMute = () => {
    setIsVoiceMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("voltpulse_voice_muted", String(next));
      } catch (e) {}
      if (next && typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const speakText = (text) => {
    if (isAdmin || isVoiceMuted || typeof window === "undefined" || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Bind session to active chassis
  useEffect(() => {
    if (isAdmin || !userChassis || !userProfile?.email) return;

    fetch(`${API_BASE}/api/session/bind`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userProfile.userId || "OWN-DEFAULT",
        vehicleId: userProfile.vehicleId || "VEH-DEFAULT",
        vehicleModel: userProfile.vehicleModel || "3S Hardware Testbench (12V L298N)",
        email: userProfile.email,
        fullName: userProfile.fullName || "Vehicle Owner",
        chassisNumber: userChassis,
        calibration: userProfile.calibration || null
      })
    })
      .then((res) => res.json())
      .catch((err) => console.error(`[Multi-Tenant Bind Error for ${userChassis}]:`, err));
  }, [userProfile, isAdmin, userChassis]);

  // Real-time Firestore sync for Fault History
  useEffect(() => {
    if (!currentUser || isAdmin) return;
    const incidentsRef = collection(db, "users", currentUser.uid, "fault_history");
    const q = query(incidentsRef, orderBy("timestampRaw", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = [];
      snapshot.forEach((docSnap) => {
        records.push({ id: docSnap.id, ...docSnap.data() });
      });
      setFaultHistory(records);
    }, (error) => {
      console.error("Firestore fault history listener error:", error);
    });

    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  // Real-time Firestore sync for 60s Telemetry Logs
  useEffect(() => {
    if (!currentUser || isAdmin) return;
    const logsRef = collection(db, "users", currentUser.uid, "telemetry_logs");
    const q = query(logsRef, orderBy("timestampRaw", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = [];
      snapshot.forEach((docSnap) => {
        records.push({ id: docSnap.id, ...docSnap.data() });
      });
      setTelemetryLogs(records);
    }, (error) => {
      console.error("Firestore telemetry logs listener error:", error);
    });

    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  // Continuous 60-Second Sensor Logger
  useEffect(() => {
    if (!currentUser || isAdmin || !userChassis) return;

    const timer = setInterval(() => {
      const tel = latestTelemetryRef.current;
      const agent = latestAgentResultRef.current;

      const v = parseFloat(tel?.Voltage ?? tel?.bus_voltage ?? 0);
      const temp = parseFloat(tel?.Temperature ?? tel?.motor_temp ?? 0);

      if (v <= 0.5 && temp <= 1.0) return;

      const now = new Date();
      const currentClass = agent?.diagnosis?.fault_class ?? 0;
      const currentLabel = agent?.diagnosis?.diagnosis_label || (currentClass === 0 ? "Normal Operation" : "Fault Detected");

      const minuteBucket = Math.floor(now.getTime() / 60000);
      const logDocId = `LOG_${userChassis}_${minuteBucket}`;

      const record = {
        timestampRaw: now.getTime(),
        date: formatEVDate(now),
        time: formatEVTime(now),
        chassis: userChassis,
        voltage: v.toFixed(2),
        current: parseFloat(tel?.Current ?? tel?.current_amps ?? 0).toFixed(2),
        temperature: temp.toFixed(1),
        rpm: Math.round(tel?.motor_rpm ?? 0),
        ambient_temp: parseFloat(tel?.ambient_temp ?? 25.0).toFixed(1),
        ambient_humidity: parseFloat(tel?.ambient_humidity ?? 50.0).toFixed(0),
        status: currentLabel,
        faultClass: currentClass
      };

      const logDocRef = doc(db, "users", currentUser.uid, "telemetry_logs", logDocId);
      setDoc(logDocRef, record, { merge: true }).catch((e) =>
        console.error("Error logging 60s telemetry:", e)
      );
    }, 60000);

    return () => clearInterval(timer);
  }, [currentUser, isAdmin, userChassis]);

  // Fault Transition Logger
  useEffect(() => {
    if (!agentResult || !currentUser || isAdmin || !userChassis) return;

    const diagnosis = agentResult.diagnosis;
    if (!diagnosis) return;

    const currentActiveClasses = (diagnosis.fault_classes || (diagnosis.fault_class !== 0 ? [diagnosis.fault_class] : []))
      .filter((c) => c !== 0)
      .sort((a, b) => a - b);

    const currentCount = currentActiveClasses.length;
    const currentSignature = currentActiveClasses.join("_");

    const tel = latestTelemetryRef.current;
    const v = parseFloat(tel?.Voltage ?? tel?.bus_voltage ?? 0);
    const temp = parseFloat(tel?.Temperature ?? tel?.motor_temp ?? 0);

    if (v <= 0.5 && temp <= 1.0) return;
    if (lastProcessedSignatureRef.current === currentSignature) return;

    const lastEvent = faultHistory.length > 0 ? faultHistory[0] : null;
    if (lastEvent && (lastEvent.signature ?? "") === currentSignature && (Date.now() - (lastEvent.timestampRaw || 0) < 15000)) {
      lastProcessedSignatureRef.current = currentSignature;
      return;
    }

    let prevActiveClasses = [];
    if (lastEvent) {
      if (lastEvent.eventType === "RECOVERY_NORMAL") {
        prevActiveClasses = [];
      } else if (Array.isArray(lastEvent.faultClasses)) {
        prevActiveClasses = lastEvent.faultClasses.filter((c) => c !== 0).sort((a, b) => a - b);
      } else if (lastEvent.faultClass && lastEvent.faultClass !== 0) {
        prevActiveClasses = [lastEvent.faultClass];
      }
    }

    const prevCount = prevActiveClasses.length;
    const prevSignature = prevActiveClasses.join("_");

    if (currentSignature !== prevSignature) {
      const prevSet = new Set(prevActiveClasses);
      const currSet = new Set(currentActiveClasses);

      const addedClasses = currentActiveClasses.filter((c) => !prevSet.has(c));
      const clearedClasses = prevActiveClasses.filter((c) => !currSet.has(c));

      const addedNames = addedClasses.map((c) => FAULT_NAMES[c] || `Fault ${c}`);
      const clearedNames = clearedClasses.map((c) => FAULT_NAMES[c] || `Fault ${c}`);
      const activeNames = currentActiveClasses.map((c) => FAULT_NAMES[c] || `Fault ${c}`);

      let eventType = "";
      let transitionLabel = "";

      if (prevCount === 0 && currentCount > 0) {
        eventType = "FAULT_INCEPTION";
        transitionLabel = `Initial Fault Inception (${currentCount} Active): Detected ${activeNames.join(" & ")}`;
      } else if (currentCount === 0 && prevCount > 0) {
        eventType = "RECOVERY_NORMAL";
        transitionLabel = `Restored to Safe Operation: Cleared ${clearedNames.join(" & ")}`;
      } else if (currentCount > prevCount) {
        eventType = "FAULT_ESCALATED";
        transitionLabel = `Faults Increased (${prevCount} → ${currentCount}): Added ${addedNames.join(" & ")}. Active: ${activeNames.join(" & ")}`;
      } else if (currentCount < prevCount && currentCount > 0) {
        eventType = "FAULT_DEESCALATED";
        transitionLabel = `Faults Decreased (${prevCount} → ${currentCount}): Cleared ${clearedNames.join(" & ")}. Active: ${activeNames.join(" & ")}`;
      } else {
        eventType = "FAULT_TRANSITION";
        transitionLabel = `Fault Shifted: Cleared ${clearedNames.join(" & ")}, Added ${addedNames.join(" & ")}. Active: ${activeNames.join(" & ")}`;
      }

      lastProcessedSignatureRef.current = currentSignature;

      const now = new Date();
      const timeBucket = Math.floor(now.getTime() / 15000);
      const docId = `EVT_${userChassis}_${eventType}_${currentSignature || "SAFE"}_${timeBucket}`;

      const record = {
        timestampRaw: now.getTime(),
        date: formatEVDate(now),
        time: formatEVTime(now),
        eventType: eventType,
        signature: currentSignature,
        chassis: userChassis,
        faultCount: currentCount,
        prevCount: prevCount,
        faultClass: diagnosis.fault_class,
        faultClasses: currentActiveClasses,
        addedFaults: addedNames,
        clearedFaults: clearedNames,
        activeFaults: activeNames,
        label: transitionLabel,
        subsystem: diagnosis.affected_subsystem || "Main Powertrain",
        voltage: v.toFixed(2),
        current: parseFloat(tel?.Current ?? tel?.current_amps ?? 0).toFixed(2),
        temp: temp.toFixed(1),
        rpm: Math.round(tel?.motor_rpm ?? 0),
        ambient_temp: parseFloat(tel?.ambient_temp ?? 25.0).toFixed(1),
        ambient_humidity: parseFloat(tel?.ambient_humidity ?? 50.0).toFixed(0)
      };

      const docRef = doc(db, "users", currentUser.uid, "fault_history", docId);
      setDoc(docRef, record, { merge: true }).catch((e) =>
        console.error("Error logging state transition:", e)
      );
    }
  }, [agentResult, currentUser, isAdmin, userChassis, faultHistory]);

  const updateRollingHistory = (newTel) => {
    const timeStr = formatEVTime(new Date());
    setHistory((prev) => {
      const point = {
        time: timeStr,
        voltage: parseFloat(newTel.Voltage ?? newTel.bus_voltage ?? 0).toFixed(2),
        current: parseFloat(newTel.Current ?? newTel.current_amps ?? 0).toFixed(2),
        temperature: parseFloat(newTel.Temperature ?? newTel.motor_temp ?? 0).toFixed(1),
        rpm: Math.round(newTel.motor_rpm ?? 0)
      };
      return [...prev, point].slice(-20);
    });
  };

  // Co-Pilot Voice playback
  useEffect(() => {
    if (isAdmin || isVoiceMuted || !agentResult) return;

    const diagnosis = agentResult.diagnosis;
    if (!diagnosis) return;

    const activeClasses = (diagnosis.fault_classes || (diagnosis.fault_class !== 0 ? [diagnosis.fault_class] : []))
      .filter((c) => c !== 0)
      .sort((a, b) => a - b);

    const currentSignature = activeClasses.length === 0 ? "SAFE" : activeClasses.join("_");
    const script = agentResult?.outreach?.voice_script;

    if (!script) return;

    if (currentSignature === "SAFE") {
      if (!hasSpokenInitialGreetingRef.current) {
        speakText(script);
        hasSpokenInitialGreetingRef.current = true;
        lastSpokenSignatureRef.current = "SAFE";
        return;
      }
      if (lastSpokenSignatureRef.current !== null && lastSpokenSignatureRef.current !== "SAFE") {
        speakText(script);
        lastSpokenSignatureRef.current = "SAFE";
        return;
      }
      return;
    }

    if (currentSignature !== lastSpokenSignatureRef.current) {
      speakText(script);
      lastSpokenSignatureRef.current = currentSignature;
    }
  }, [agentResult, isVoiceMuted, isAdmin]);

  // WebSocket lifecycle management
  useEffect(() => {
    if (isAdmin || !userChassis) return;

    let ws = null;
    let fallbackInterval = null;

    const wsProtocol = API_BASE.startsWith("https") ? "wss" : "ws";
    const cleanHost = API_BASE.replace(/^https?:\/\//, "");
    const chassisWsUrl = `${wsProtocol}://${cleanHost}/ws/telemetry/${userChassis}`;

    const connect = () => {
      try {
        ws = new WebSocket(chassisWsUrl);
        ws.onopen = () => setSource(`LIVE_WS_${userChassis}`);
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.telemetry) {
            setTelemetry(data.telemetry);
            updateRollingHistory(data.telemetry);
          }
          if (data.agent_result) setAgentResult(data.agent_result);
          if (data.source) setSource(data.source);
        };
        ws.onerror = () => setSource("POLLING_FALLBACK");
        ws.onclose = () => {
          setSource("POLLING_FALLBACK");
          if (!fallbackInterval) fallbackInterval = setInterval(fetchLatest, 2000);
        };
      } catch (err) {
        setSource("POLLING_FALLBACK");
        fallbackInterval = setInterval(fetchLatest, 2000);
      }
    };

    const fetchLatest = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/state/latest/${userChassis}`);
        const data = await res.json();
        if (data.telemetry) {
          setTelemetry(data.telemetry);
          updateRollingHistory(data.telemetry);
        }
        if (data.agent_result) setAgentResult(data.agent_result);
        if (data.source) setSource(data.source);
      } catch (e) {
        setSource("DISCONNECTED");
      }
    };

    connect();

    return () => {
      if (ws) ws.close(1000, `User closed session (${userChassis})`);
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      fetch(`${API_BASE}/api/session/unbind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chassisNumber: userChassis })
      }).catch(() => {});

      setTelemetry(defaultContextValue.telemetry);
      setAgentResult(null);
      setHistory([]);
      setSource("STANDBY_OFFLINE");
      hasSpokenInitialGreetingRef.current = false;
      lastSpokenSignatureRef.current = null;
    };
  }, [isAdmin, userChassis]);

  const triggerSimulation = async (faultClass) => {
    if (!userChassis) return;
    setIsSimulating(true);
    try {
      const res = await fetch(`${API_BASE}/api/simulate/${userChassis}/${faultClass}`, { method: "POST" });
      const data = await res.json();
      if (data.state) {
        setTelemetry(data.state.telemetry);
        setAgentResult(data.state.agent_result);
        setSource(data.state.source);
        updateRollingHistory(data.state.telemetry);
      }
    } catch (e) {
      console.error(`Simulation failed for ${userChassis}:`, e);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <TelemetryContext.Provider value={{
      telemetry,
      agentResult,
      source,
      history,
      faultHistory,
      telemetryLogs,
      isSimulating,
      triggerSimulation,
      isVoiceMuted,
      toggleVoiceMute,
      speakText
    }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export const useTelemetry = () => useContext(TelemetryContext) || defaultContextValue;