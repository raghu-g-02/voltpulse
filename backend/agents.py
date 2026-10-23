import smtplib
import ssl
import time
import math
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from ml_engine import diagnostic_engine
from config import ENABLE_GMAIL_ALERTS, SMTP_SERVER, SMTP_PORT, SENDER_GMAIL, SENDER_APP_PASSWORD

FAULT_NAME_MAP = {
    1: "Motor Transmission Overload / Mechanical Jam",
    2: "Inverter Bus Voltage Out-of-Bounds (Sag / Surge)",
    3: "Battery Pack Thermal Overheat",
    4: "Drivetrain Severe Mechanical Vibration & Imbalance",
}

DEFAULT_MODEL_CALIBRATION = {
    "modelName": "Nexon EV",
    "manufacturer": "Tata Motors",
    "voltage_min": 9.8,
    "voltage_max": 12.6,
    "voltage_nominal": 11.8,
    "current_nominal": 0.20,
    "current_max": 0.85,
    "temp_nominal": 28.0,
    "temp_max": 38.0,
    "rpm_min": 30,
    "rpm_max": 260,
    "vibration_max": 2.2,
    "assignedChassis": ["MAT612089N1A23456"],
}

class PredictiveDiagnosticAgent:
    """
    Evaluates vehicle telemetry against the model's Admin-calibrated thresholds.
    """

    def diagnose(self, telemetry: dict, model_calibration: dict = None) -> dict:
        v = float(telemetry.get("Voltage", telemetry.get("bus_voltage", 0.0)))
        i = float(telemetry.get("Current", telemetry.get("current_amps", 0.0)))
        t = float(telemetry.get("Temperature", telemetry.get("motor_temp", 0.0)))
        rpm = float(telemetry.get("motor_rpm", telemetry.get("rpm", 0.0)))
        amb_t = float(telemetry.get("ambient_temp", 25.0))
        amb_h = float(telemetry.get("ambient_humidity", 50.0))
        vib_x = float(telemetry.get("vibration_x", 0.0))
        vib_y = float(telemetry.get("vibration_y", 0.0))
        vib_z = float(telemetry.get("vibration_z", 9.81))

        limits = model_calibration if model_calibration and isinstance(model_calibration, dict) else DEFAULT_MODEL_CALIBRATION

        # Extract thresholds defined by the OEM Admin in VehicleModelManager
        v_min = float(limits.get("voltage_min", limits.get("voltage_sag_limit", 9.8)))
        v_max = float(limits.get("voltage_max", float(limits.get("voltage_nominal", 11.8)) * 1.15))
        v_nom = float(limits.get("voltage_nominal", (v_min + v_max) / 2.0))
        i_max = float(limits.get("current_max", limits.get("current_overload_limit", 0.85)))
        t_max = float(limits.get("temp_max", limits.get("temp_critical_limit", 38.0)))
        rpm_min = float(limits.get("rpm_min", 30))
        rpm_max = float(limits.get("rpm_max", limits.get("rpm_max_rated", 260)))
        vib_max = float(limits.get("vibration_max", limits.get("vibration_limit", 2.2)))
        model_name = limits.get("modelName", "Nexon EV")

        # Hardware standby or disconnected state
        if v <= 0.2 and t <= 1.0:
            return {
                "fault_class": 0,
                "fault_classes": [0],
                "active_faults": [],
                "fault_count": 0,
                "confidence_pct": 100.0,
                "diagnosis_label": "System Standby / Offline",
                "affected_subsystem": "Powertrain Core Nominal",
                "severity": "NOMINAL",
                "asil_rating": "QM",
                "hazard_description": "Hardware in standby or sensor bus initializing.",
                "driver_suggestion": "Power on battery and logic rail to begin real-time monitoring.",
                "dtc_code": "DTC-SYS-000",
                "model_applied": model_name,
                "normalized_stress": {
                    "voltage_breach": 0.0,
                    "current_load": 0.0,
                    "thermal_load": 0.0,
                    "rpm_load": 0.0,
                    "dynamic_vibration": 0.0,
                },
                "freeze_frame": {
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "trigger_dtc": "DTC-SYS-000",
                    "bus_voltage_v": 0.0,
                    "current_draw_a": 0.0,
                    "core_temp_c": 0.0,
                    "motor_speed_rpm": 0.0,
                    "asil_rating": "QM",
                },
            }

        # Stress calculations against Admin thresholds
        if v < v_min:
            norm_v_stress = (v_min - v) / max(0.1, v_min) + 1.0
        elif v > v_max:
            norm_v_stress = (v - v_max) / max(0.1, v_max) + 1.0
        else:
            norm_v_stress = 0.0

        norm_i_stress = i / max(0.01, i_max)
        norm_t_stress = max(0.0, (t - amb_t) / max(1.0, (t_max - amb_t))) if t > amb_t else 0.0
        norm_rpm = rpm / max(1.0, rpm_max)

        # Dynamic vibration isolated from static gravity tilt
        total_accel = math.sqrt(vib_x**2 + vib_y**2 + vib_z**2)
        dynamic_vib = max(0.0, abs(total_accel - 9.81))
        norm_vib = dynamic_vib / max(0.1, vib_max)

        ml_result = diagnostic_engine.predict(telemetry)
        ml_fault_class = ml_result.get("fault_class", 0)

        active_fault_items = []
        fault_classes_detected = set()

        # Check 1: Voltage boundary
        if norm_v_stress >= 1.0 or ml_fault_class == 2:
            fault_classes_detected.add(2)
            condition_desc = f"{v:.2f}V < {v_min:.2f}V Min Sag" if v < v_min else f"{v:.2f}V > {v_max:.2f}V Max Surge"
            active_fault_items.append({
                "class": 2,
                "label": FAULT_NAME_MAP[2],
                "subsystem": "Traction Voltage Rail",
                "severity": "CRITICAL",
                "dtc": "DTC-ELEC-202",
                "threshold_breach": f"Voltage {condition_desc} (Safe Envelope: {v_min:.2f}V - {v_max:.2f}V)",
                "suggestion": f"Voltage outside OEM envelope ({v_min:.2f}V - {v_max:.2f}V). Check battery charge state and supply."
            })

        # Check 2: Current overload
        if norm_i_stress >= 1.0 or (i >= (i_max * 0.75) and rpm < rpm_min) or ml_fault_class == 1:
            fault_classes_detected.add(1)
            active_fault_items.append({
                "class": 1,
                "label": FAULT_NAME_MAP[1],
                "subsystem": "Drivetrain Gearbox & Motor",
                "severity": "HIGH",
                "dtc": "DTC-MECH-101",
                "threshold_breach": f"Current {i:.2f}A >= {i_max:.2f}A Cutoff (Stress: {norm_i_stress*100:.0f}%)",
                "suggestion": f"Current breached OEM cutoff ({i_max:.2f}A). Check motor for mechanical binding or wheel stall."
            })

        # Check 3: Thermal cutoff
        if norm_t_stress >= 1.0 or t >= t_max or ml_fault_class == 3:
            fault_classes_detected.add(3)
            active_fault_items.append({
                "class": 3,
                "label": FAULT_NAME_MAP[3],
                "subsystem": "Thermal Enclosure",
                "severity": "EMERGENCY",
                "dtc": "DTC-THERM-303",
                "threshold_breach": f"Temperature {t:.1f}°C >= {t_max:.1f}°C Cutoff (Delta: +{(t - amb_t):.1f}°C)",
                "suggestion": f"Temperature exceeded safety limit ({t_max:.1f}°C). Pull over safely and let powertrain cool."
            })

        # Check 4: Dynamic vibration
        if norm_vib >= 1.0:
            fault_classes_detected.add(1)
            active_fault_items.append({
                "class": 1,
                "label": FAULT_NAME_MAP[4],
                "subsystem": "Chassis Mounts & IMU",
                "severity": "MEDIUM",
                "dtc": "DTC-VIB-404",
                "threshold_breach": f"Dynamic vibration {dynamic_vib:.2f} m/s² >= {vib_max:.2f} m/s² Cutoff",
                "suggestion": f"Vibration exceeded safe cutoff ({vib_max:.2f} m/s²). Check mounting screws and motor alignment."
            })

        if not active_fault_items:
            fault_classes_detected.add(0)
            primary_class = 0
            composite_label = "Nominal Operation"
            combined_subsystem = "All Sensor Channels Within Calibrated Bounds"
            primary_severity = "NOMINAL"
            primary_asil = "QM"
            primary_dtc = "DTC-SYS-000"
            hazard_desc = f"Operating nominally within calibrated {model_name} envelopes."
            combined_suggestion = "Powertrain operating nominally within calibrated limits. Safe and fine to drive."
            active_count = 0
        else:
            active_count = len(active_fault_items)
            classes_sorted = sorted(list(fault_classes_detected), reverse=True)
            primary_class = classes_sorted[0]
            labels_list = [item["label"] for item in active_fault_items]
            subsystems_list = list(set([item["subsystem"] for item in active_fault_items]))
            suggestions_list = [item["suggestion"] for item in active_fault_items]

            composite_label = f"Multiple Faults ({active_count} Active): " + " & ".join(labels_list) if active_count > 1 else active_fault_items[0]["label"]
            combined_subsystem = ", ".join(subsystems_list)
            combined_suggestion = " ".join(suggestions_list)
            primary_severity = "EMERGENCY" if 3 in fault_classes_detected else ("CRITICAL" if 2 in fault_classes_detected else "HIGH")
            primary_asil = "ASIL-D" if 3 in fault_classes_detected else ("ASIL-C" if 2 in fault_classes_detected else "ASIL-B")
            primary_dtc = active_fault_items[0]["dtc"]
            hazard_desc = f"Threshold breach detected across {active_count} channel(s) on {model_name}."

        freeze_frame = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "trigger_dtc": primary_dtc,
            "bus_voltage_v": round(v, 2),
            "current_draw_a": round(i, 2),
            "core_temp_c": round(t, 1),
            "motor_speed_rpm": round(rpm, 0),
            "dynamic_vibration_ms2": round(dynamic_vib, 2),
            "asil_rating": primary_asil,
        }

        return {
            **ml_result,
            "fault_class": primary_class,
            "fault_classes": sorted(list(fault_classes_detected)),
            "fault_count": active_count,
            "active_faults": active_fault_items,
            "diagnosis_label": composite_label,
            "dtc_code": primary_dtc,
            "severity": primary_severity,
            "affected_subsystem": combined_subsystem,
            "hazard_description": hazard_desc,
            "driver_suggestion": combined_suggestion,
            "asil_rating": primary_asil,
            "model_applied": model_name,
            "applied_thresholds": {
                "voltage_min": v_min,
                "voltage_max": v_max,
                "current_max": i_max,
                "temp_max": t_max,
                "rpm_min": rpm_min,
                "rpm_max": rpm_max,
                "vibration_max": vib_max,
            },
            "normalized_stress": {
                "voltage_breach": round(norm_v_stress, 2),
                "current_load": round(norm_i_stress, 2),
                "thermal_load": round(norm_t_stress, 2),
                "rpm_load": round(norm_rpm, 2),
                "dynamic_vibration": round(norm_vib, 2),
            },
            "freeze_frame": freeze_frame,
        }


class AutonomousOutreachAgent:
    def __init__(self):
        self.last_email_sent_times = {}
        self.EMAIL_COOLDOWN_SECONDS = 180

    def generate_human_voice_script(self, diagnosis: dict, raw_telemetry: dict) -> str:
        fault_classes = [c for c in diagnosis.get("fault_classes", [0]) if c != 0]
        temp = raw_telemetry.get("Temperature", raw_telemetry.get("motor_temp", 28.0))
        curr = raw_telemetry.get("Current", 0.2)
        volt = raw_telemetry.get("Voltage", 11.8)

        if not fault_classes:
            return "System recovered. All powertrain readings have normalized. It is now safe and fine to drive."

        if len(fault_classes) > 1:
            return (
                f"Warning! Multiple calibrated limits breached: current draw at {curr:.2f} amperes "
                f"and temperature at {temp:.1f} degrees. Please ease off throttle immediately."
            )

        single = fault_classes[0]
        if single == 1:
            return f"Caution: Motor transmission stall detected! Current draw reached {curr:.2f} amperes. Please relieve mechanical load."
        elif single == 2:
            return f"Notice: Voltage out of calibrated safe range at {volt:.2f} volts. Battery recharge or check required."
        elif single == 3:
            return f"Emergency safety alert: Battery temperature has climbed to {temp:.1f} degrees Celsius, breaching safety threshold!"

        return "Warning: Powertrain anomaly detected."

    def send_gmail_alert(self, diagnosis: dict, raw_telemetry: dict, voice_script: str, active_owner: dict):
        fault_classes = [c for c in diagnosis.get("fault_classes", [0]) if c != 0]
        if not ENABLE_GMAIL_ALERTS or not fault_classes:
            return

        recipient_email = active_owner.get("email")
        chassis = active_owner.get("chassisNumber", raw_telemetry.get("chassis", "MAT612089N1A23456"))
        if not recipient_email or not SENDER_APP_PASSWORD:
            return

        current_time = time.time()
        signature = "_".join(map(str, sorted(fault_classes)))
        cooldown_key = (chassis, signature)

        if current_time - self.last_email_sent_times.get(cooldown_key, 0) < self.EMAIL_COOLDOWN_SECONDS:
            return

        self.last_email_sent_times[cooldown_key] = current_time

        def _email_worker():
            try:
                subject = f"Diagnostic Alert for Chassis [{chassis}]"
                v = raw_telemetry.get("Voltage", 0.0)
                i = raw_telemetry.get("Current", 0.0)
                t = raw_telemetry.get("Temperature", 0.0)
                rpm = raw_telemetry.get("motor_rpm", 0.0)
                owner_name = active_owner.get("fullName", "Driver")

                html_body = f"""
                <html>
                  <body style="font-family: Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px;">
                    <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0;">
                      <h2 style="color: #0284c7; margin-top: 0;">VoltPulse Safety Advisory</h2>
                      <p>Dear <strong>{owner_name}</strong>,</p>
                      
                      <div style="background-color: #fef2f2; padding: 14px; border-radius: 8px; border-left: 4px solid #e11d48; margin: 15px 0;">
                        <p style="font-size: 14px; color: #9f1239; margin: 0; font-weight: bold;">{voice_script}</p>
                      </div>

                      <table style="width: 100%; font-size: 13px; color: #334155; margin-bottom: 15px;">
                        <tr><td><strong>Chassis VIN:</strong></td><td style="color: #0284c7; font-weight: bold;">{chassis}</td></tr>
                        <tr><td><strong>Status:</strong></td><td style="color: #e11d48; font-weight: bold;">{diagnosis.get('diagnosis_label')}</td></tr>
                        <tr><td><strong>Recommendation:</strong></td><td>{diagnosis.get('driver_suggestion')}</td></tr>
                        <tr><td><strong>Pack Voltage:</strong></td><td>{v:.2f} V</td></tr>
                        <tr><td><strong>Current Draw:</strong></td><td>{i:.2f} A</td></tr>
                        <tr><td><strong>Temperature:</strong></td><td>{t:.1f} °C</td></tr>
                        <tr><td><strong>Speed:</strong></td><td>{rpm:.0f} RPM</td></tr>
                      </table>
                    </div>
                  </body>
                </html>
                """

                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = SENDER_GMAIL
                msg["To"] = recipient_email
                msg.attach(MIMEText(html_body, "html"))

                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
                    server.login(SENDER_GMAIL, SENDER_APP_PASSWORD)
                    server.sendmail(SENDER_GMAIL, recipient_email, msg.as_string())

                print(f"[Alert] Email dispatched to {recipient_email} for Chassis {chassis}")
            except Exception as e:
                print(f"[Email Error] Failed to send email to {recipient_email}: {e}")

        threading.Thread(target=_email_worker, daemon=True).start()

    def execute_service_booking(self, diagnosis: dict) -> dict:
        fault_classes = [c for c in diagnosis.get("fault_classes", [0]) if c != 0]
        if not fault_classes:
            return {"booking_required": False, "status": "No action needed"}

        if 3 in fault_classes:
            bay = "Emergency Thermal Isolation Bay 4"
        elif 2 in fault_classes:
            bay = "High-Voltage Electrical Bay 1"
        else:
            bay = "Mechanical Drivetrain Bay 2"

        return {
            "booking_required": True,
            "booking_id": f"SRV-RIG-{int(time.time()) % 10000}",
            "assigned_bay": bay,
            "slot_time": "Immediate Hardware Priority Slot",
            "service_hub": "Bengaluru Central EV Tech Bench",
        }


class MasterOrchestratorAgent:
    def __init__(self):
        self.diagnostic_agent = PredictiveDiagnosticAgent()
        self.outreach_agent = AutonomousOutreachAgent()

    def process_telemetry(self, raw_telemetry: dict, active_owner: dict = None) -> dict:
        if not active_owner:
            return None

        cal = active_owner.get("calibration", DEFAULT_MODEL_CALIBRATION)
        diagnosis = self.diagnostic_agent.diagnose(raw_telemetry, model_calibration=cal)
        voice_script = self.outreach_agent.generate_human_voice_script(diagnosis, raw_telemetry)

        if diagnosis["fault_class"] != 0:
            self.outreach_agent.send_gmail_alert(diagnosis, raw_telemetry, voice_script, active_owner)

        booking = self.outreach_agent.execute_service_booking(diagnosis)

        return {
            "orchestrator_state": "ACTIVE_MONITORING" if diagnosis["fault_class"] == 0 else "ANOMALY_ESCALATED",
            "alert_active": diagnosis["fault_class"] != 0,
            "diagnosis": diagnosis,
            "outreach": {
                "voice_script": voice_script,
                "timestamp": time.strftime("%H:%M:%S"),
            },
            "booking": booking,
        }

orchestrator = MasterOrchestratorAgent()