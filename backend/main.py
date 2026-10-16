# backend/main.py
import os
import json
import asyncio
import requests
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

from agents import orchestrator, DEFAULT_DEMO_CALIBRATION

app = FastAPI(title="VoltPulse AI Multi-Tenant Concurrent Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_vehicle_sessions: Dict[str, Dict[str, Any]] = {}
vehicle_models_catalog: Dict[str, Dict[str, Any]] = {}
active_simulations: Dict[str, Dict[str, Any]] = {}

# Exact Singapore regional endpoint from Firebase Console
FIREBASE_RTDB_BASE = os.getenv(
    "FIREBASE_DATABASE_URL", 
    "https://major-pro-8b1c9-default-rtdb.asia-southeast1.firebasedatabase.app"
).rstrip("/")

class SessionBindRequest(BaseModel):
    userId: str
    vehicleId: str
    vehicleModel: str
    companyName: Optional[str] = None
    email: str
    fullName: str
    chassisNumber: str
    calibration: Optional[Dict[str, Any]] = None

class SessionUnbindRequest(BaseModel):
    chassisNumber: str

class ModelSyncRequest(BaseModel):
    modelId: str
    modelData: Dict[str, Any]

@app.get("/")
def read_root():
    return {
        "system": "VoltPulse AI Multi-Tenant Concurrent Engine",
        "database_endpoint": FIREBASE_RTDB_BASE,
        "active_vehicle_sessions": list(active_vehicle_sessions.keys()),
        "cached_models": list(vehicle_models_catalog.keys()),
        "total_active_sessions": len(active_vehicle_sessions),
    }

@app.post("/api/session/bind")
def bind_session(req: SessionBindRequest):
    chassis = req.chassisNumber.strip().upper()
    cal = req.calibration or vehicle_models_catalog.get(req.vehicleModel) or DEFAULT_DEMO_CALIBRATION
    
    active_vehicle_sessions[chassis] = {
        "userId": req.userId,
        "vehicleId": req.vehicleId,
        "vehicleModel": req.vehicleModel,
        "companyName": req.companyName or "Tata Motors",
        "email": req.email,
        "fullName": req.fullName,
        "chassisNumber": chassis,
        "calibration": cal,
    }
    print(f"[Session Bound] Chassis: {chassis} -> Model: {req.vehicleModel} ({cal.get('voltage_nominal')}V / {cal.get('current_overload_limit')}A)")
    return {"status": "SUCCESS", "chassis": chassis, "calibration": cal}

@app.post("/api/session/unbind")
def unbind_session(req: SessionUnbindRequest):
    chassis = req.chassisNumber.strip().upper()
    if chassis in active_vehicle_sessions:
        del active_vehicle_sessions[chassis]
        print(f"[Session Unbound] Chassis: {chassis}")
    return {"status": "SUCCESS", "chassis": chassis}

@app.post("/api/models/sync")
def sync_model(req: ModelSyncRequest):
    vehicle_models_catalog[req.modelId] = req.modelData
    updated_chassis = []
    for c, sess in active_vehicle_sessions.items():
        if (
            sess.get("vehicleModel", "").strip().lower() == req.modelData.get("modelName", "").strip().lower()
            or sess.get("vehicleModel") == req.modelId
        ):
            sess["calibration"] = req.modelData
            updated_chassis.append(c)

    print(f"[Model Synced] {req.modelId} updated across active sessions: {updated_chassis}")
    return {"status": "SUCCESS", "modelId": req.modelId, "affected_sessions": len(updated_chassis)}

def _extract_telemetry_fields(data: Any, chassis: str) -> Optional[dict]:
    if not isinstance(data, dict):
        return None

    if chassis in data and isinstance(data[chassis], dict):
        data = data[chassis]
    elif "telemetry" in data and isinstance(data["telemetry"], dict):
        data = data["telemetry"]

    lower_map = {str(k).lower(): v for k, v in data.items() if not isinstance(v, (dict, list))}

    v_raw = lower_map.get("voltage", lower_map.get("bus_voltage", None))
    if v_raw is not None:
        try:
            return {
                "Voltage": float(v_raw),
                "Current": float(lower_map.get("current", lower_map.get("current_amps", 0.0))),
                "Temperature": float(lower_map.get("temperature", lower_map.get("temp", lower_map.get("motor_temp", 0.0)))),
                "motor_rpm": float(lower_map.get("motor_rpm", lower_map.get("rpm", 0.0))),
                "ambient_temp": float(lower_map.get("ambient_temp", 25.0)),
                "ambient_humidity": float(lower_map.get("ambient_humidity", 50.0)),
                "vibration_x": float(lower_map.get("vibration_x", 0.05)),
                "vibration_y": float(lower_map.get("vibration_y", 0.08)),
                "vibration_z": float(lower_map.get("vibration_z", 9.82)),
                "chassis": chassis,
            }
        except (ValueError, TypeError):
            pass
    return None

def fetch_firebase_telemetry(chassis: str) -> dict:
    """Dynamically queries Realtime Database for ANY registered chassis."""
    clean_chassis = chassis.strip().upper()
    lookup_paths = [
        f"/{clean_chassis}.json",
        f"/telemetry/{clean_chassis}.json",
        f"/.json"
    ]

    for path in lookup_paths:
        url = f"{FIREBASE_RTDB_BASE}{path}"
        try:
            resp = requests.get(url, timeout=2.5)
            if resp.status_code == 200 and resp.json():
                extracted = _extract_telemetry_fields(resp.json(), clean_chassis)
                if extracted is not None:
                    return extracted
        except Exception as e:
            continue

    return {
        "Voltage": 0.0,
        "Current": 0.0,
        "Temperature": 0.0,
        "motor_rpm": 0.0,
        "ambient_temp": 25.0,
        "ambient_humidity": 50.0,
        "vibration_x": 0.05,
        "vibration_y": 0.08,
        "vibration_z": 9.82,
        "chassis": clean_chassis,
    }

@app.get("/api/telemetry/{chassis}")
def get_telemetry(chassis: str):
    c = chassis.strip().upper()
    sim = active_simulations.get(c)
    if sim:
        return {"source": f"SIMULATION_{c}", "telemetry": sim}
    tel = fetch_firebase_telemetry(c)
    return {"source": f"FIREBASE_LIVE_{c}", "telemetry": tel}

@app.get("/api/state/latest/{chassis}")
def get_latest_state(chassis: str):
    c = chassis.strip().upper()
    session = active_vehicle_sessions.get(c, {
        "chassisNumber": c,
        "email": "owner@voltpulse.io",
        "fullName": "Vehicle Owner",
        "calibration": DEFAULT_DEMO_CALIBRATION,
    })

    sim = active_simulations.get(c)
    if sim:
        raw_tel = sim
        src = f"SIMULATION_{c}"
    else:
        raw_tel = fetch_firebase_telemetry(c)
        src = f"FIREBASE_LIVE_{c}"

    res = orchestrator.process_telemetry(raw_tel, session)
    return {"source": src, "telemetry": raw_tel, "agent_result": res}

@app.post("/api/simulate/{chassis}/{fault_class}")
def simulate_fault(chassis: str, fault_class: int):
    c = chassis.strip().upper()
    session = active_vehicle_sessions.get(c, {
        "chassisNumber": c,
        "calibration": DEFAULT_DEMO_CALIBRATION,
    })
    cal = session.get("calibration", DEFAULT_DEMO_CALIBRATION)

    v_nom = float(cal.get("voltage_nominal", 5.0))
    v_sag = float(cal.get("voltage_sag_limit", 4.2))
    i_crit = float(cal.get("current_overload_limit", 0.95))
    t_crit = float(cal.get("temp_critical_limit", 42.0))
    rpm_max = float(cal.get("rpm_max_rated", 250))

    if fault_class == 0:
        sim_data = {
            "Voltage": v_nom,
            "Current": round(float(cal.get("current_nominal", 0.25)), 2),
            "Temperature": 28.0,
            "motor_rpm": round(rpm_max * 0.8),
            "ambient_temp": 25.0,
            "ambient_humidity": 50.0,
            "vibration_x": 0.05,
            "vibration_y": 0.08,
            "vibration_z": 9.82,
            "chassis": c,
        }
    elif fault_class == 1:
        sim_data = {
            "Voltage": v_nom,
            "Current": round(i_crit * 1.35, 2),
            "Temperature": 32.0,
            "motor_rpm": round(rpm_max * 0.45),
            "ambient_temp": 25.0,
            "ambient_humidity": 50.0,
            "vibration_x": 0.25,
            "vibration_y": 0.40,
            "vibration_z": 9.82,
            "chassis": c,
        }
    elif fault_class == 2:
        sim_data = {
            "Voltage": round(v_sag * 0.80, 2),
            "Current": round(float(cal.get("current_nominal", 0.25)), 2),
            "Temperature": 30.0,
            "motor_rpm": round(rpm_max * 0.6),
            "ambient_temp": 25.0,
            "ambient_humidity": 50.0,
            "vibration_x": 0.05,
            "vibration_y": 0.08,
            "vibration_z": 9.82,
            "chassis": c,
        }
    elif fault_class == 3:
        sim_data = {
            "Voltage": v_nom,
            "Current": round(float(cal.get("current_nominal", 0.25)), 2),
            "Temperature": round(t_crit + 8.5, 1),
            "motor_rpm": round(rpm_max * 0.5),
            "ambient_temp": 25.0,
            "ambient_humidity": 50.0,
            "vibration_x": 0.05,
            "vibration_y": 0.08,
            "vibration_z": 9.82,
            "chassis": c,
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid fault class (0-3)")

    active_simulations[c] = sim_data
    agent_res = orchestrator.process_telemetry(sim_data, session)
    return {"status": "SUCCESS", "state": {"source": f"SIMULATION_{c}", "telemetry": sim_data, "agent_result": agent_res}}

@app.websocket("/ws/telemetry/{chassis}")
async def websocket_telemetry(websocket: WebSocket, chassis: str):
    await websocket.accept()
    c = chassis.strip().upper()
    print(f"[WebSocket Connected] Live stream established for chassis: {c}")

    try:
        while True:
            session = active_vehicle_sessions.get(c, {
                "chassisNumber": c,
                "email": "owner@voltpulse.io",
                "fullName": "Vehicle Owner",
                "calibration": DEFAULT_DEMO_CALIBRATION,
            })

            sim = active_simulations.get(c)
            if sim:
                raw_tel = sim
                src = f"SIMULATION_{c}"
            else:
                raw_tel = fetch_firebase_telemetry(c)
                src = f"FIREBASE_LIVE_{c}"

            agent_res = orchestrator.process_telemetry(raw_tel, session)

            payload = {
                "source": src,
                "telemetry": raw_tel,
                "agent_result": agent_res,
                "calibration": session.get("calibration", DEFAULT_DEMO_CALIBRATION),
            }

            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(2.0)
    except WebSocketDisconnect:
        print(f"[WebSocket Disconnected] Client closed for chassis: {c}")
    except Exception as e:
        print(f"[WebSocket Error] {e}")