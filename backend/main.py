import asyncio
import json
import requests
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from config import FIREBASE_DATABASE_URL
from agents import orchestrator

app = FastAPI(title="VoltPulse AI Multi-Tenant Concurrent Telematics Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory Multi-Tenant State Registry
active_vehicles: dict[str, dict] = {}


class OwnerSessionPayload(BaseModel):
    userId: str
    vehicleId: str
    vehicleModel: str
    email: str
    fullName: str
    chassisNumber: str


class UnbindPayload(BaseModel):
    chassisNumber: str


def safe_float(val, default=0.0):
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def get_default_vehicle_state(chassis: str) -> dict:
    return {
        "telemetry": {
            "chassis": chassis,
            "Voltage": 0.0,
            "Current": 0.0,
            "Temperature": 0.0,
            "motor_rpm": 0.0,
            "vibration_x": 0.05,
            "vibration_y": 0.08,
            "vibration_z": 9.82,
            "ambient_temp": 25.0,
            "ambient_humidity": 50.0,
        },
        "agent_result": None,
        "owner": None,
        "source": "STANDBY_OFFLINE",
    }


def fetch_live_chassis_telemetry(chassis_number: str) -> dict:
    """Dynamically fetches real-time telemetry from /{chassis_number}.json in Firebase RTDB."""
    if not chassis_number:
        return None
    try:
        clean_chassis = chassis_number.strip().upper()
        url = f"{FIREBASE_DATABASE_URL.rstrip('/')}/{clean_chassis}.json"
        res = requests.get(url, timeout=2.0)

        if res.status_code == 200 and res.json():
            data = res.json()
            if isinstance(data, dict):
                return {
                    "chassis": clean_chassis,
                    "Voltage": safe_float(data.get("Voltage", data.get("voltage")), 0.0),
                    "Current": safe_float(data.get("Current", data.get("current")), 0.0),
                    "Temperature": safe_float(data.get("Temperature", data.get("temperature")), 25.0),
                    "motor_rpm": safe_float(data.get("motor_rpm", data.get("rpm")), 0.0),
                    "vibration_x": safe_float(data.get("vibration_x"), 0.05),
                    "vibration_y": safe_float(data.get("vibration_y"), 0.08),
                    "vibration_z": safe_float(data.get("vibration_z"), 9.82),
                    "ambient_temp": safe_float(data.get("ambient_temp"), 25.0),
                    "ambient_humidity": safe_float(data.get("ambient_humidity"), 50.0),
                }
    except Exception as e:
        print(f"[Firebase Multi-Tenant Fetch Error ({chassis_number})]: {e}")
    return None


@app.get("/")
def root():
    return {
        "system": "VoltPulse AI Multi-Tenant Concurrent Engine",
        "active_vehicle_sessions": list(active_vehicles.keys()),
        "total_active_sessions": len(active_vehicles),
    }


@app.get("/api/state/latest/{chassis_number}")
def get_latest_state(chassis_number: str):
    clean_chassis = chassis_number.strip().upper()
    v_state = active_vehicles.get(clean_chassis)
    if not v_state:
        v_state = get_default_vehicle_state(clean_chassis)
        active_vehicles[clean_chassis] = v_state

    if v_state.get("owner") and v_state.get("agent_result") is None:
        v_state["agent_result"] = orchestrator.process_telemetry(
            v_state["telemetry"], v_state["owner"]
        )
    return v_state


@app.get("/api/telemetry/{chassis_number}")
def get_specific_chassis_telemetry(chassis_number: str):
    """Admin inspect endpoint: reads live telemetry from Firebase for any requested vehicle."""
    clean_chassis = chassis_number.strip().upper()
    data = fetch_live_chassis_telemetry(clean_chassis)
    if data:
        return {"status": "ONLINE", "telemetry": data}

    v_state = active_vehicles.get(clean_chassis)
    if v_state and v_state["telemetry"]["Voltage"] > 0:
        return {"status": "ONLINE_CACHED", "telemetry": v_state["telemetry"]}

    return {
        "status": "OFFLINE_STANDBY",
        "telemetry": {
            "chassis": clean_chassis,
            "Voltage": 0.0,
            "Current": 0.0,
            "Temperature": 0.0,
            "motor_rpm": 0.0,
            "ambient_temp": 25.0,
            "ambient_humidity": 50.0,
        },
    }


@app.post("/api/session/bind")
def bind_owner_session(payload: OwnerSessionPayload):
    """Dynamically binds an individual user session to their registered vehicle chassis."""
    clean_chassis = payload.chassisNumber.strip().upper()

    if clean_chassis not in active_vehicles:
        active_vehicles[clean_chassis] = get_default_vehicle_state(clean_chassis)

    v_state = active_vehicles[clean_chassis]
    v_state["owner"] = payload.model_dump()
    v_state["source"] = f"LIVE_SESSION_{clean_chassis}"

    # Immediately fetch fresh Firebase state
    fresh_telemetry = fetch_live_chassis_telemetry(clean_chassis)
    if fresh_telemetry:
        v_state["telemetry"] = fresh_telemetry
        v_state["agent_result"] = orchestrator.process_telemetry(
            fresh_telemetry, v_state["owner"]
        )

    print(f"\n[MULTI-TENANT BOUND] Owner '{payload.fullName}' ({payload.email}) linked to Chassis '{clean_chassis}'")
    print(f"Total concurrent vehicle sessions: {len(active_vehicles)}")

    return {
        "status": "BOUND_SUCCESSFULLY",
        "active_chassis": clean_chassis,
        "owner": v_state["owner"],
    }


@app.post("/api/session/unbind")
def unbind_owner_session(payload: UnbindPayload):
    clean_chassis = payload.chassisNumber.strip().upper()
    if clean_chassis in active_vehicles:
        active_vehicles[clean_chassis]["owner"] = None
        active_vehicles[clean_chassis]["source"] = "STANDBY_OFFLINE"
        active_vehicles[clean_chassis]["agent_result"] = None
        print(f"\n[MULTI-TENANT UNBOUND] Session for Chassis '{clean_chassis}' disconnected.")
    return {"status": "UNBOUND_SUCCESSFULLY", "chassis": clean_chassis}


@app.post("/api/simulate/{chassis_number}/{fault_class}")
def simulate_fault_for_chassis(chassis_number: str, fault_class: int):
    clean_chassis = chassis_number.strip().upper()
    presets = {
        0: {"Voltage": 4.35, "Current": 1.20, "motor_rpm": 230.0, "Temperature": 28.0, "vibration_x": 0.05, "vibration_y": 0.08, "vibration_z": 9.82, "ambient_temp": 25.0, "ambient_humidity": 50.0},
        1: {"Voltage": 4.20, "Current": 2.80, "motor_rpm": 60.0, "Temperature": 34.0, "vibration_x": 14.5, "vibration_y": 12.2, "vibration_z": 9.81, "ambient_temp": 25.0, "ambient_humidity": 50.0},
        2: {"Voltage": 2.50, "Current": 0.35, "motor_rpm": 140.0, "Temperature": 30.0, "vibration_x": 0.15, "vibration_y": 0.20, "vibration_z": 9.81, "ambient_temp": 25.0, "ambient_humidity": 50.0},
        3: {"Voltage": 1.70, "Current": 1.95, "motor_rpm": 170.0, "Temperature": 68.5, "vibration_x": 0.25, "vibration_y": 0.30, "vibration_z": 9.81, "ambient_temp": 25.0, "ambient_humidity": 50.0},
        # Compound Simulation 4: Inverter Sag + Critical Thermal Overheat
        4: {"Voltage": 2.20, "Current": 1.50, "motor_rpm": 110.0, "Temperature": 72.0, "vibration_x": 0.30, "vibration_y": 0.35, "vibration_z": 9.81, "ambient_temp": 25.0, "ambient_humidity": 50.0},
        # Compound Simulation 5: Motor Overload + Inverter Sag + Critical Thermal Overheat (Triple Fault)
        5: {"Voltage": 2.10, "Current": 3.10, "motor_rpm": 45.0, "Temperature": 75.0, "vibration_x": 15.0, "vibration_y": 14.0, "vibration_z": 9.80, "ambient_temp": 25.0, "ambient_humidity": 50.0},
    }

    if clean_chassis not in active_vehicles:
        active_vehicles[clean_chassis] = get_default_vehicle_state(clean_chassis)

    v_state = active_vehicles[clean_chassis]
    sim_data = presets.get(fault_class, presets[0]).copy()
    sim_data["chassis"] = clean_chassis
    v_state["telemetry"] = sim_data

    if v_state.get("owner"):
        v_state["agent_result"] = orchestrator.process_telemetry(
            sim_data, v_state["owner"]
        )

    v_state["source"] = f"SIMULATION_CLASS_{fault_class}"
    return {
        "status": "SUCCESS",
        "chassis": clean_chassis,
        "injected_fault": fault_class,
        "state": v_state,
    }


@app.post("/api/simulate/{fault_class}")
def simulate_fault_fallback(fault_class: int):
    target_chassis = list(active_vehicles.keys())[0] if active_vehicles else "DEFAULT_CHASSIS"
    return simulate_fault_for_chassis(target_chassis, fault_class)


@app.websocket("/ws/telemetry/{chassis_number}")
async def websocket_telemetry_stream_per_chassis(websocket: WebSocket, chassis_number: str):
    """
    Dedicated WebSocket per chassis. Runs an independent 2-second streaming
    and ML diagnostic loop isolated strictly to this vehicle.
    """
    await websocket.accept()
    clean_chassis = chassis_number.strip().upper()

    if clean_chassis not in active_vehicles:
        active_vehicles[clean_chassis] = get_default_vehicle_state(clean_chassis)

    try:
        while True:
            v_state = active_vehicles[clean_chassis]
            live_data = fetch_live_chassis_telemetry(clean_chassis)

            if live_data:
                v_state["telemetry"] = live_data
                if v_state.get("owner"):
                    v_state["agent_result"] = orchestrator.process_telemetry(
                        live_data, v_state["owner"]
                    )
                v_state["source"] = f"LIVE_FIREBASE_{clean_chassis}"
            elif v_state.get("owner") and v_state.get("agent_result") is None:
                v_state["agent_result"] = orchestrator.process_telemetry(
                    v_state["telemetry"], v_state["owner"]
                )

            await websocket.send_text(json.dumps(v_state))
            await asyncio.sleep(2.0)
    except WebSocketDisconnect:
        pass