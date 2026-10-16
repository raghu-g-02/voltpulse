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

# Active sessions and model envelopes cache
active_vehicle_sessions: Dict[str, Dict[str, Any]] = {}
vehicle_models_catalog: Dict[str, Dict[str, Any]] = {}
active_simulations: Dict[str, Dict[str, Any]] = {}

FIREBASE_RTDB_BASE = os.getenv(
    "FIREBASE_DATABASE_URL", 
    "https://major-pro-8b1c9-default-rtdb.firebaseio.com"
).rstrip("/")

class SessionBindRequest(BaseModel):
    userId: str
    vehicleId: str
    vehicleModel: str
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
        "active_vehicle_sessions": list(active_vehicle_sessions.keys()),
        "cached_models": list(vehicle_models_catalog.keys()),
        "total_active_sessions": len(active_vehicle_sessions),
    }

@app.post("/api/session/bind")
def bind_session(req: SessionBindRequest):
    chassis = req.chassisNumber.strip().upper()
    
    # Resolve calibration: either directly provided, from catalog, or fallback to demo
    cal = req.calibration or vehicle_models_catalog.get(req.vehicleModel) or DEFAULT_DEMO_CALIBRATION
    
    active_vehicle_sessions[chassis] = {
        "userId": req.userId,
        "vehicleId": req.vehicleId,
        "vehicleModel": req.vehicleModel,
        "email": req.email,
        "fullName": req.fullName,
        "chassisNumber": chassis,
        "calibration": cal,
    }
    print(f"[Session Bound] Chassis: {chassis} -> Model: {req.vehicleModel}")
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
    # Update all active vehicle sessions assigned to this model in real time
    updated_chassis = []
    for c, sess in active_vehicle_sessions.items():
        if sess.get("vehicleModel") == req.modelData.get("modelName") or sess.get("vehicleModel") == req.modelId:
            sess["calibration"] = req.modelData
            updated_chassis.append(c)

    print(f"[Model Synced] {req.modelId} updated across active sessions: {updated_chassis}")
    return {"status": "SUCCESS", "modelId": req.modelId, "affected_sessions": len(updated_chassis)}

def fetch_firebase_telemetry(chassis: str) -> dict:
    url = f"{FIREBASE_RTDB_BASE}/{chassis}.json"
    try:
        resp = requests.get(url, timeout=2.0)
        if resp.status_code == 200 and resp.json():
            data = resp.json()
            return {
                "Voltage": float(data.get("Voltage", data.get("voltage", 0.0))),
                "Current": float(data.get("Current", data.get("current", 0.0))),
                "Temperature": float(data.get("Temperature", data.get("temperature", 0.0))),
                "motor_rpm": float(data.get("motor_rpm", data.get("rpm", 0.0))),
                "ambient_temp": float(data.get("ambient_temp", 25.0)),
                "ambient_humidity": float(data.get("ambient_humidity", 50.0)),
                "chassis": chassis,
            }
    except Exception:
        pass

    return {
        "Voltage": 0.0,
        "Current": 0.0,
        "Temperature": 0.0,
        "motor_rpm": 0.0,
        "ambient_temp": 25.0,
        "ambient_humidity": 50.0,
        "chassis": chassis,
    }

@app.get("/api/telemetry/{chassis}")
def get_telemetry(chassis: str):
    c = chassis.strip().upper()
    sim = active_simulations.get(c)
    if sim:
        return {"source": "SIMULATION", "telemetry": sim}
    tel = fetch_firebase_telemetry(c)
    return {"source": "FIREBASE_LIVE", "telemetry": tel}

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
        src = "SIMULATION"
    else:
        raw_tel = fetch_firebase_telemetry(c)
        src = "FIREBASE_LIVE"

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
            "chassis": c,
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid fault class (0-3)")

    active_simulations[c] = sim_data
    agent_res = orchestrator.process_telemetry(sim_data, session)
    return {"status": "SUCCESS", "state": {"source": "SIMULATION", "telemetry": sim_data, "agent_result": agent_res}}

@app.websocket("/ws/telemetry/{chassis}")
async def websocket_telemetry(websocket: WebSocket, chassis: str):
    await websocket.accept()
    c = chassis.strip().upper()
    print(f"[WebSocket Connected] Chassis: {c}")

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
                src = "SIMULATION"
            else:
                raw_tel = fetch_firebase_telemetry(c)
                src = "FIREBASE_LIVE"

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
        print(f"[WebSocket Disconnected] Chassis: {c}")
    except Exception as e:
        print(f"[WebSocket Error] {e}")