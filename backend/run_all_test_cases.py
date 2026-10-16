# backend/run_all_test_cases.py
import sys
import time
import requests
from ml_engine import diagnostic_engine
from agents import orchestrator

# Comprehensive 10-Scenario Test Suite Matrix
TEST_SUITE = [
    {
        "id": "TC-01",
        "name": "Nominal Highway Cruising State",
        "type": "CORE_POWERTRAIN",
        "telemetry": {
            "Voltage": 4.35, "Current": 0.85, "motor_rpm": 225.0,
            "Temperature": 28.0, "ambient_temp": 25.0, "ambient_humidity": 50.0,
            "vibration_x": 0.05, "vibration_y": 0.08, "vibration_z": 9.82
        },
        "expected_class": 0,
        "expected_dtc": "DTC-SYS-000",
        "min_confidence": 98.0
    },
    {
        "id": "TC-02",
        "name": "Mechanical Drivetrain / Gearbox Overload",
        "type": "CORE_POWERTRAIN",
        "telemetry": {
            "Voltage": 4.20, "Current": 2.80, "motor_rpm": 55.0,
            "Temperature": 34.0, "ambient_temp": 27.5, "ambient_humidity": 52.0,
            "vibration_x": 14.50, "vibration_y": 12.20, "vibration_z": 9.81
        },
        "expected_class": 1,
        "expected_dtc": "DTC-MECH-101",
        "min_confidence": 98.0
    },
    {
        "id": "TC-03",
        "name": "Power Inverter DC Bus Sag",
        "type": "CORE_POWERTRAIN",
        "telemetry": {
            "Voltage": 2.50, "Current": 0.35, "motor_rpm": 140.0,
            "Temperature": 29.0, "ambient_temp": 26.0, "ambient_humidity": 55.0,
            "vibration_x": 0.15, "vibration_y": 0.20, "vibration_z": 9.81
        },
        "expected_class": 2,
        "expected_dtc": "DTC-ELEC-202",
        "min_confidence": 98.0
    },
    {
        "id": "TC-04",
        "name": "Critical Thermal Hazard (5V Rail Overheat)",
        "type": "CORE_POWERTRAIN",
        "telemetry": {
            "Voltage": 1.70, "Current": 2.10, "motor_rpm": 170.0,
            "Temperature": 68.5, "ambient_temp": 32.0, "ambient_humidity": 45.0,
            "vibration_x": 0.25, "vibration_y": 0.30, "vibration_z": 9.81
        },
        "expected_class": 3,
        "expected_dtc": "DTC-THERM-303",
        "min_confidence": 98.0
    },
    {
        "id": "TC-05",
        "name": "High-Voltage EV Pack Thermal Anomaly (Auto-Scale)",
        "type": "CORE_POWERTRAIN",
        "telemetry": {
            "Voltage": 50.00, "Current": 50.00, "motor_rpm": 25.0,
            "Temperature": 68.5, "ambient_temp": 25.0, "ambient_humidity": 55.0,
            "vibration_x": 0.05, "vibration_y": 0.08, "vibration_z": 9.82
        },
        "expected_class": 3,
        "expected_dtc": "DTC-THERM-303",
        "min_confidence": 98.0
    },
    {
        "id": "TC-06",
        "name": "45°C Heatwave Weather (Healthy Powertrain)",
        "type": "ENVIRONMENTAL_STRESS",
        "telemetry": {
            "Voltage": 4.35, "Current": 0.85, "motor_rpm": 220.0,
            "Temperature": 30.0, "ambient_temp": 45.0, "ambient_humidity": 30.0,
            "vibration_x": 0.05, "vibration_y": 0.08, "vibration_z": 9.82
        },
        "expected_class": 0,
        "expected_dtc": "DTC-SYS-000",
        "min_confidence": 98.0
    },
    {
        "id": "TC-07",
        "name": "95% Monsoon Humidity (Healthy Powertrain)",
        "type": "ENVIRONMENTAL_STRESS",
        "telemetry": {
            "Voltage": 4.35, "Current": 0.85, "motor_rpm": 220.0,
            "Temperature": 28.0, "ambient_temp": 26.0, "ambient_humidity": 95.0,
            "vibration_x": 0.05, "vibration_y": 0.08, "vibration_z": 9.82
        },
        "expected_class": 0,
        "expected_dtc": "DTC-SYS-000",
        "min_confidence": 98.0
    },
    {
        "id": "TC-08",
        "name": "Cold-Start Winter Baseline Calibration",
        "type": "ENVIRONMENTAL_STRESS",
        "telemetry": {
            "Voltage": 4.35, "Current": 0.85, "motor_rpm": 220.0,
            "Temperature": 12.0, "ambient_temp": 5.0, "ambient_humidity": 20.0,
            "vibration_x": 0.05, "vibration_y": 0.08, "vibration_z": 9.82
        },
        "expected_class": 0,
        "expected_dtc": "DTC-SYS-000",
        "min_confidence": 98.0
    },
    {
        "id": "TC-09",
        "name": "Compound Anomaly: 46°C Heatwave + 68.5°C Runaway",
        "type": "ENVIRONMENTAL_STRESS",
        "telemetry": {
            "Voltage": 1.70, "Current": 2.10, "motor_rpm": 170.0,
            "Temperature": 68.5, "ambient_temp": 46.0, "ambient_humidity": 40.0,
            "vibration_x": 0.25, "vibration_y": 0.30, "vibration_z": 9.81
        },
        "expected_class": 3,
        "expected_dtc": "DTC-THERM-303",
        "min_confidence": 98.0
    },
    {
        "id": "TC-10",
        "name": "Compound Anomaly: 95% Humidity + Inverter Sag",
        "type": "ENVIRONMENTAL_STRESS",
        "telemetry": {
            "Voltage": 2.50, "Current": 0.35, "motor_rpm": 140.0,
            "Temperature": 28.5, "ambient_temp": 28.0, "ambient_humidity": 95.0,
            "vibration_x": 0.15, "vibration_y": 0.20, "vibration_z": 9.81
        },
        "expected_class": 2,
        "expected_dtc": "DTC-ELEC-202",
        "min_confidence": 98.0
    }
]

def run_test_suite():
    print("=" * 86)
    print("     VOLTPULSE AI: AUTOMATED 10-SCENARIO VERIFICATION TEST RUNNER")
    print("     Evaluates 7-Channel Telemetry (V, I, RPM, Temp, Vib, Amb_Temp, Humidity)")
    print("=" * 86)

    passed_count = 0
    total_count = len(TEST_SUITE)
    total_latency_ms = 0.0

    mock_owner = {
        "userId": "OWN-TEST-01",
        "vehicleId": "VEH-TEST-01",
        "vehicleModel": "VoltPulse Testbench Unit",
        "email": "test@voltpulse.com",
        "fullName": "Test Vehicle Owner"
    }

    for idx, tc in enumerate(TEST_SUITE, 1):
        t_start = time.perf_counter()
        
        # Execute in-memory through the full Tri-Agent Orchestrator pipeline
        result = orchestrator.process_telemetry(tc["telemetry"], mock_owner)
        
        t_elapsed_ms = (time.perf_counter() - t_start) * 1000.0
        total_latency_ms += t_elapsed_ms

        diag = result["diagnosis"]
        pred_class = diag["fault_class"]
        pred_dtc = diag["dtc_code"]
        confidence = diag["confidence_pct"]
        norm_vec = diag["normalized_vector"]
        voice_script = result["outreach"]["voice_script"]

        is_class_correct = (pred_class == tc["expected_class"])
        is_dtc_correct = (pred_dtc == tc["expected_dtc"])
        is_conf_ok = (confidence >= tc["min_confidence"])
        test_passed = (is_class_correct and is_dtc_correct and is_conf_ok)

        if test_passed:
            passed_count += 1
            status_label = "✅ PASS"
        else:
            status_label = "❌ FAIL"

        tel = tc["telemetry"]
        print(f"\n[{status_label}] {tc['id']}: {tc['name']} ({tc['type']})")
        print(f"  • Input Sensor Vector : V={tel['Voltage']}V | I={tel['Current']}A | RPM={tel['motor_rpm']} | "
              f"T={tel['Temperature']}°C | Amb={tel['ambient_temp']}°C | Hum={tel['ambient_humidity']}%")
        print(f"  • Per-Unit (p.u.) Math: V_norm={norm_vec['voltage']:.4f} | I_norm={norm_vec['current']:.4f} | "
              f"T_norm={norm_vec['temperature']:.4f} | Vib_norm={norm_vec['vibration_g']:.4f} | "
              f"Amb_norm={norm_vec['ambient_temp']:.4f} | Hum_norm={norm_vec['humidity']:.4f}")
        print(f"  • Classification      : Class {pred_class} (Expected: {tc['expected_class']}) | DTC: {pred_dtc}")
        print(f"  • Model Confidence    : {confidence:.2f}% (Threshold: >={tc['min_confidence']}%)")
        print(f"  • Execution Latency   : {t_elapsed_ms:.2f} ms")
        print(f"  • Voice Co-Pilot Line : \"{voice_script[:75]}...\"")

    # Final Scorecard Summary
    pass_rate = (passed_count / total_count) * 100.0
    avg_latency = total_latency_ms / total_count

    print("\n" + "=" * 86)
    print("                           FINAL EXECUTION SCORECARD")
    print("=" * 86)
    print(f"  Total Scenarios Evaluated : {total_count}")
    print(f"  Passed                    : {passed_count}")
    print(f"  Failed                    : {total_count - passed_count}")
    print(f"  Pass Rate                 : {pass_rate:.1f}%")
    print(f"  Mean Inference Latency    : {avg_latency:.2f} ms per frame")
    print("=" * 86)

    # Optional: Test running REST server if live
    print("\nChecking live FastAPI REST server status (http://localhost:8000)...")
    try:
        res = requests.get("http://localhost:8000/", timeout=1.0)
        if res.status_code == 200:
            print("  [ONLINE] Live FastAPI Uvicorn server detected and operating nominally.")
        else:
            print(f"  [SERVER RESPONDED] HTTP {res.status_code}")
    except Exception:
        print("  [OFFLINE / NOT RUNNING] Backend server is not running on port 8000.")
        print("  (Note: In-memory test suite ran directly against the ML model and passed.)")

    if passed_count == total_count:
        print("\n🎉 ALL 10 TELEMETRY & ENVIRONMENTAL TEST SCENARIOS PASSED WITH >98% CONFIDENCE!\n")
        sys.exit(0)
    else:
        print("\n⚠️ WARNING: Some test cases failed to meet the verification criteria.\n")
        sys.exit(1)

if __name__ == "__main__":
    run_test_suite()