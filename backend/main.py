import os
import json
import asyncio
import requests
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

from agents import orchestrator, DEFAULT_MODEL_CALIBRATION

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
simulation_tasks: Dict[str, asyncio.Task] = {}

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

def find_calibration_for_chassis(chassis: str, requested_model: str = "") -> dict:
    """Matches a chassis number to the Admin-calibrated model envelope."""
    clean_chassis = chassis.strip().upper()

    # 1. Match by pre-assigned VIN list in catalog (Python .upper() fix)
    for m_id, m_data in vehicle_models_catalog.items():
        assigned = m_data.get("assignedChassis", [])
        if isinstance(assigned, list) and any(str(c).strip().upper() == clean_chassis for c in assigned):
            return m_data

    # 2. Match by model name
    if requested_model:
        norm_req = requested_model.strip().lower()
        for m_id, m_data in vehicle_models_catalog.items():
            if m_data.get("modelName", "").strip().lower() == norm_req or m_id.lower() == norm_req:
                return m_data

    return vehicle_models_catalog.get("nexon-ev", DEFAULT_MODEL_CALIBRATION)

@app.get("/")
def read_root():
    return {
        "system": "VoltPulse AI Multi-Tenant Concurrent Engine",
        "database_endpoint": FIREBASE_RTDB_BASE,
        "active_vehicle_sessions": list(active_vehicle_sessions.keys()),
        "active_simulations": list(active_simulations.keys()),
        "cached_models": list(vehicle_models_catalog.keys()),
        "total_active_sessions": len(active_vehicle_sessions),
    }

@app.post("/api/session/bind")
def bind_session(req: SessionBindRequest):
    chassis = req.chassisNumber.strip().upper()
    
    # Prioritize supplied calibration, then catalog lookup, then fallback
    cal = req.calibration or find_calibration_for_chassis(chassis, req.vehicleModel) or DEFAULT_MODEL_CALIBRATION
    
    # Cache model into catalog memory
    model_name_key = (cal.get("modelName") or req.vehicleModel).strip().lower().replace(" ", "-")
    vehicle_models_catalog[model_name_key] = cal

    active_vehicle_sessions[chassis] = {
        "userId": req.userId,
        "vehicleId": req.vehicleId,
        "vehicleModel": cal.get("modelName", req.vehicleModel),
        "companyName": cal.get("manufacturer", req.companyName or "Tata Motors"),
        "email": req.email,
        "fullName": req.fullName,
        "chassisNumber": chassis,
        "calibration": cal,
    }
    return {"status": "SUCCESS", "chassis": chassis, "calibration": cal}

@app.post("/api/session/unbind")
def unbind_session(req: SessionUnbindRequest):
    chassis = req.chassisNumber.strip().upper()
    if chassis in active_vehicle_sessions:
        del active_vehicle_sessions[chassis]
    return {"status": "SUCCESS", "chassis": chassis}

@app.post("/api/models/sync")
def sync_model(req: ModelSyncRequest):
    vehicle_models_catalog[req.modelId] = req.modelData
    updated_chassis = []

    model_name = req.modelData.get("modelName", "").strip().lower()
    assigned_vins = [str(c).strip().upper() for c in req.modelData.get("assignedChassis", [])]

    for c, sess in active_vehicle_sessions.items():
        if (
            sess.get("vehicleModel", "").strip().lower() == model_name
            or c in assigned_vins
            or sess.get("vehicleModel") == req.modelId
        ):
            sess["calibration"] = req.modelData
            sess["vehicleModel"] = req.modelData.get("modelName", sess.get("vehicleModel"))
            updated_chassis.append(c)

    return {"status": "SUCCESS", "modelId": req.modelId, "affected_sessions": len(updated_chassis)}

def _extract_telemetry_fields(data: Any, chassis: str) -> Optional[dict]:
    if not isinstance(data, dict):
        return None

    if "live" in data and isinstance(data["live"], dict):
        data = data["live"]
    elif chassis in data and isinstance(data[chassis], dict):
        data = data[chassis]
        if "live" in data and isinstance(data["live"], dict):
            data = data["live"]

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
                "vibration_z": float(lower_map.get("vibration_z", 9.81)),
                "chassis": chassis,
            }
        except (ValueError, TypeError):
            pass
    return None

def fetch_firebase_telemetry(chassis: str) -> dict:
    clean_chassis = chassis.strip().upper()
    lookup_paths = [
        f"/vehicles/{clean_chassis}/live.json",
        f"/vehicles/{clean_chassis}.json",
        f"/{clean_chassis}.json",
        f"/{clean_chassis}/live.json",
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
        except Exception:
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
        "vibration_z": 9.81,
        "chassis": clean_chassis,
    }

async def revert_simulation_after_delay(chassis: str, delay_seconds: float = 10.0):
    try:
        await asyncio.sleep(delay_seconds)
        if chassis in active_simulations:
            del active_simulations[chassis]
    except asyncio.CancelledError:
        pass

@app.get("/api/telemetry/{chassis}")
def get_telemetry(chassis: str):
    c = chassis.strip().upper()
    sim = active_simulations.get(c)
    if sim:
        return {"source": f"SIMULATION_{c}", "telemetry": sim, "is_simulating": True}
    tel = fetch_firebase_telemetry(c)
    return {"source": f"FIREBASE_LIVE_{c}", "telemetry": tel, "is_simulating": False}

@app.get("/api/state/latest/{chassis}")
def get_latest_state(chassis: str):
    c = chassis.strip().upper()
    session = active_vehicle_sessions.get(c)
    if not session:
        cal = find_calibration_for_chassis(c)
        session = {
            "chassisNumber": c,
            "email": "driver@voltpulse.io",
            "fullName": "Vehicle Owner",
            "calibration": cal,
        }
        active_vehicle_sessions[c] = session

    sim = active_simulations.get(c)
    if sim:
        raw_tel = sim
        src = f"SIMULATION_{c}"
        sim_active = True
    else:
        raw_tel = fetch_firebase_telemetry(c)
        src = f"FIREBASE_LIVE_{c}"
        sim_active = False

    res = orchestrator.process_telemetry(raw_tel, session)
    return {"source": src, "telemetry": raw_tel, "agent_result": res, "is_simulating": sim_active}

@app.post("/api/simulate/{chassis}/{fault_class}")
async def simulate_fault(chassis: str, fault_class: int):
    c = chassis.strip().upper()
    session = active_vehicle_sessions.get(c, {})
    cal = session.get("calibration") or find_calibration_for_chassis(c)

    v_min = float(cal.get("voltage_min", cal.get("voltage_sag_limit", 9.8)))
    v_max = float(cal.get("voltage_max", float(cal.get("voltage_nominal", 11.8)) * 1.15))
    v_nom = float(cal.get("voltage_nominal", (v_min + v_max) / 2.0))
    i_max = float(cal.get("current_max", cal.get("current_overload_limit", 0.85)))
    t_max = float(cal.get("temp_max", cal.get("temp_critical_limit", 38.0)))
    rpm_max = float(cal.get("rpm_max", cal.get("rpm_max_rated", 260)))

    if c in simulation_tasks and not simulation_tasks[c].done():
        simulation_tasks[c].cancel()

    if fault_class == 0:
        sim_data = {
            "Voltage": round(v_nom, 2),
            "Current": round(float(cal.get("current_nominal", 0.20)), 2),
            "Temperature": round(float(cal.get("temp_nominal", 28.0)), 1),
            "motor_rpm": round(rpm_max * 0.85),
            "ambient_temp": 26.4,
            "ambient_humidity": 52.0,
            "vibration_x": 0.14,
            "vibration_y": 0.09,
            "vibration_z": 9.81,
            "chassis": c,
        }
    elif fault_class == 1:
        sim_data = {
            "Voltage": round(v_nom, 2),
            "Current": round(i_max * 1.40, 2),
            "Temperature": 32.0,
            "motor_rpm": 25.0,
            "ambient_temp": 26.4,
            "ambient_humidity": 52.0,
            "vibration_x": 0.45,
            "vibration_y": 0.60,
            "vibration_z": 9.81,
            "chassis": c,
        }
    elif fault_class == 2:
        sim_data = {
            "Voltage": round(max(0.0, v_min - 1.2), 2),
            "Current": 0.24,
            "Temperature": 29.5,
            "motor_rpm": round(rpm_max * 0.55),
            "ambient_temp": 26.4,
            "ambient_humidity": 52.0,
            "vibration_x": 0.12,
            "vibration_y": 0.10,
            "vibration_z": 9.81,
            "chassis": c,
        }
    elif fault_class == 3:
        sim_data = {
            "Voltage": round(v_nom, 2),
            "Current": 0.22,
            "Temperature": round(t_max + 4.5, 1),
            "motor_rpm": round(rpm_max * 0.8),
            "ambient_temp": 26.4,
            "ambient_humidity": 52.0,
            "vibration_x": 0.15,
            "vibration_y": 0.12,
            "vibration_z": 9.81,
            "chassis": c,
        }
    elif fault_class == 4:
        sim_data = {
            "Voltage": round(v_nom, 2),
            "Current": 0.35,
            "Temperature": 30.0,
            "motor_rpm": round(rpm_max * 0.9),
            "ambient_temp": 26.4,
            "ambient_humidity": 52.0,
            "vibration_x": 2.2,
            "vibration_y": 2.0,
            "vibration_z": 9.81,
            "chassis": c,
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid fault class (0-4)")

    active_simulations[c] = sim_data
    agent_res = orchestrator.process_telemetry(sim_data, session)
    simulation_tasks[c] = asyncio.create_task(revert_simulation_after_delay(c, 10.0))

    return {
        "status": "SUCCESS",
        "duration_seconds": 10.0,
        "state": {
            "source": f"SIMULATION_{c}",
            "telemetry": sim_data,
            "agent_result": agent_res,
            "is_simulating": True
        }
    }

@app.post("/api/simulate/{chassis}/reset")
def reset_simulation(chassis: str):
    c = chassis.strip().upper()
    if c in simulation_tasks and not simulation_tasks[c].done():
        simulation_tasks[c].cancel()
    if c in active_simulations:
        del active_simulations[c]
    return {"status": "SUCCESS", "message": f"Reverted {c} to live Firebase RTDB"}

@app.websocket("/ws/telemetry/{chassis}")
async def websocket_telemetry(websocket: WebSocket, chassis: str):
    await websocket.accept()
    c = chassis.strip().upper()

    try:
        while True:
            session = active_vehicle_sessions.get(c)
            if not session:
                cal = find_calibration_for_chassis(c)
                session = {
                    "chassisNumber": c,
                    "email": "driver@voltpulse.io",
                    "fullName": "Vehicle Owner",
                    "calibration": cal,
                }
                active_vehicle_sessions[c] = session

            sim = active_simulations.get(c)
            if sim:
                raw_tel = sim
                src = f"SIMULATION_{c}"
                sim_active = True
            else:
                raw_tel = fetch_firebase_telemetry(c)
                src = f"FIREBASE_LIVE_{c}"
                sim_active = False

            agent_res = orchestrator.process_telemetry(raw_tel, session)

            payload = {
                "source": src,
                "telemetry": raw_tel,
                "agent_result": agent_res,
                "is_simulating": sim_active,
                "calibration": session.get("calibration", DEFAULT_MODEL_CALIBRATION),
            }

            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(2.0)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket Error] {e}")