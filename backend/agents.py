import smtplib
import ssl
import time
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from ml_engine import diagnostic_engine
from config import ENABLE_GMAIL_ALERTS, SMTP_SERVER, SMTP_PORT, SENDER_GMAIL, SENDER_APP_PASSWORD

FAULT_NAME_MAP = {
    1: "Motor Transmission Overload",
    2: "Inverter Electrical Voltage Sag",
    3: "Critical Battery Thermal Overheat",
}

DEFAULT_DEMO_CALIBRATION = {
    "modelName": "5V TT-Motor Testbench",
    "manufacturer": "Benchtop Laboratory",
    "voltage_nominal": 5.0,
    "voltage_sag_limit": 4.2,
    "current_nominal": 0.25,
    "current_overload_limit": 0.95,
    "temp_nominal": 27.0,
    "temp_critical_limit": 42.0,
    "rpm_max_rated": 250,
}

class PredictiveDiagnosticAgent:
    """
    Evaluates multi-channel telemetry against model-specific calibration envelopes.
    Converts raw physical readings into normalized stress ratios (0.0 to 1.0+ scale)
    so small testbench motors and high-voltage production EVs share the exact same AI engine.
    """

    def diagnose(self, telemetry: dict, model_calibration: dict = None) -> dict:
        v = float(telemetry.get("Voltage", telemetry.get("bus_voltage", 0.0)))
        i = float(telemetry.get("Current", telemetry.get("current_amps", 0.0)))
        t = float(telemetry.get("Temperature", telemetry.get("motor_temp", 0.0)))
        rpm = float(telemetry.get("motor_rpm", 0.0))
        chassis = telemetry.get("chassis", "UNKNOWN_CHASSIS")

        limits = model_calibration if model_calibration and isinstance(model_calibration, dict) else DEFAULT_DEMO_CALIBRATION

        v_nom = float(limits.get("voltage_nominal", 5.0))
        v_sag = float(limits.get("voltage_sag_limit", 4.2))
        i_crit = float(limits.get("current_overload_limit", 0.95))
        t_crit = float(limits.get("temp_critical_limit", 42.0))
        rpm_max = float(limits.get("rpm_max_rated", 250))
        model_name = limits.get("modelName", "Generic EV Model")

        # Cold-boot / standby guard
        if v <= 0.5 and t <= 1.0:
            return {
                "fault_class": 0,
                "fault_classes": [0],
                "active_faults": [],
                "fault_count": 0,
                "confidence_pct": 100.0,
                "diagnosis_label": "System Standby",
                "affected_subsystem": "Powertrain Core Nominal",
                "severity": "NOMINAL",
                "asil_rating": "QM",
                "hazard_description": "Vehicle telemetry unit in standby / hardware initializing.",
                "dtc_code": "DTC-SYS-000",
                "model_applied": model_name,
                "normalized_stress": {
                    "voltage_sag": 0.0,
                    "current_load": 0.0,
                    "thermal_load": 0.0,
                    "rpm_load": 0.0,
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

        # Normalized stress ratios (0.0 to 1.0+ scale)
        norm_v_sag = max(0.0, (v_nom - v) / max(0.1, (v_nom - v_sag))) if v > 0.5 else 0.0
        norm_i_overload = i / max(0.05, i_crit)
        norm_t_overheat = t / max(1.0, t_crit)
        norm_rpm = rpm / max(1.0, rpm_max)

        ml_result = diagnostic_engine.predict(telemetry)
        ml_fault_class = ml_result.get("fault_class", 0)

        active_fault_items = []
        fault_classes_detected = set()

        # Dynamic Fault 1: Motor Transmission Overload
        if norm_i_overload >= 1.0 or ml_fault_class == 1:
            fault_classes_detected.add(1)
            active_fault_items.append({
                "class": 1,
                "label": FAULT_NAME_MAP[1],
                "subsystem": "Drivetrain Mechanical Transmission",
                "severity": "HIGH",
                "dtc": "DTC-MECH-101",
                "threshold_breach": f"{i:.2f}A >= {i_crit:.2f}A limit ({norm_i_overload*100:.0f}% of {model_name} max)",
            })

        # Dynamic Fault 2: Inverter Electrical Voltage Sag
        if (norm_v_sag >= 1.0 and v > 0.5) or ml_fault_class == 2:
            fault_classes_detected.add(2)
            active_fault_items.append({
                "class": 2,
                "label": FAULT_NAME_MAP[2],
                "subsystem": "Power Inverter Electrical Rail",
                "severity": "CRITICAL",
                "dtc": "DTC-ELEC-202",
                "threshold_breach": f"{v:.2f}V <= {v_sag:.2f}V limit (Stress {norm_v_sag*100:.0f}%)",
            })

        # Dynamic Fault 3: Battery Thermal Overheat
        if norm_t_overheat >= 1.0 or ml_fault_class == 3:
            fault_classes_detected.add(3)
            active_fault_items.append({
                "class": 3,
                "label": FAULT_NAME_MAP[3],
                "subsystem": "Main Battery Thermal Enclosure",
                "severity": "EMERGENCY",
                "dtc": "DTC-THERM-303",
                "threshold_breach": f"{t:.1f}°C >= {t_crit:.1f}°C limit ({norm_t_overheat*100:.0f}% thermal cap)",
            })

        if not active_fault_items:
            fault_classes_detected.add(0)
            primary_class = 0
            composite_label = "Nominal Operation"
            combined_subsystem = "All Powertrain Systems Safe"
            primary_severity = "NOMINAL"
            primary_asil = "QM"
            primary_dtc = "DTC-SYS-000"
            hazard_desc = f"Operating safely within calibrated {model_name} limits."
            active_count = 0
        else:
            active_count = len(active_fault_items)
            classes_sorted = sorted(list(fault_classes_detected), reverse=True)
            primary_class = classes_sorted[0]
            labels_list = [item["label"] for item in active_fault_items]
            subsystems_list = list(set([item["subsystem"] for item in active_fault_items]))

            composite_label = f"Multiple Faults ({active_count} Active): " + " & ".join(labels_list) if active_count > 1 else active_fault_items[0]["label"]
            combined_subsystem = ", ".join(subsystems_list)
            primary_severity = "EMERGENCY" if 3 in fault_classes_detected else ("CRITICAL" if 2 in fault_classes_detected else "HIGH")
            primary_asil = "ASIL-D" if 3 in fault_classes_detected else ("ASIL-C" if 2 in fault_classes_detected else "ASIL-B")
            primary_dtc = active_fault_items[0]["dtc"]
            hazard_desc = f"Hazards active across {active_count} subsystem(s) for vehicle model {model_name}."

        freeze_frame = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "trigger_dtc": primary_dtc,
            "bus_voltage_v": round(v, 2),
            "current_draw_a": round(i, 2),
            "core_temp_c": round(t, 1),
            "motor_speed_rpm": round(rpm, 0),
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
            "asil_rating": primary_asil,
            "hazard_description": hazard_desc,
            "model_applied": model_name,
            "normalized_stress": {
                "voltage_sag": round(norm_v_sag, 2),
                "current_load": round(norm_i_overload, 2),
                "thermal_load": round(norm_t_overheat, 2),
                "rpm_load": round(norm_rpm, 2),
            },
            "freeze_frame": freeze_frame,
        }


class AutonomousOutreachAgent:
    """Generates natural voice advisories and dispatches vehicle alerts."""

    def __init__(self):
        self.last_email_sent_times = {}
        self.EMAIL_COOLDOWN_SECONDS = 180

    def generate_human_voice_script(self, diagnosis: dict, raw_telemetry: dict) -> str:
        fault_classes = [c for c in diagnosis.get("fault_classes", [0]) if c != 0]
        temp = raw_telemetry.get("Temperature", raw_telemetry.get("motor_temp", 28.0))

        if not fault_classes:
            return "Hello! Your vehicle powertrain is in great condition and operating smoothly. You're all set for a safe journey."

        if len(fault_classes) > 1:
            fault_parts = []
            if 3 in fault_classes:
                fault_parts.append(f"critical battery overheating at {temp:.1f} degrees")
            if 2 in fault_classes:
                fault_parts.append("severe inverter voltage sag")
            if 1 in fault_classes:
                fault_parts.append("heavy motor transmission overload")

            warnings_combined = " and ".join(fault_parts)
            return (
                f"Urgent multi-system safety alert! We are detecting {warnings_combined}. "
                "Please immediately pull over safely, switch off the vehicle, and allow the battery to cool down. "
                "Emergency service dispatch has been requested."
            )

        single_class = fault_classes[0]
        if single_class == 1:
            return (
                "Notice: We're detecting abnormal mechanical resistance from your motor transmission. "
                "Please gently ease off the accelerator and have the gearbox inspected soon to avoid mechanical seizure."
            )
        elif single_class == 2:
            return (
                "Caution: Your vehicle's power inverter is experiencing a noticeable voltage drop. "
                "You may feel a temporary dip in motor acceleration. We recommend driving smoothly to the nearest service hub."
            )
        elif single_class == 3:
            return (
                f"Urgent safety advisory: Your battery pack temperature has climbed to {temp:.1f} degrees. "
                "Please safely pull over, switch off the vehicle immediately, and allow the system to cool down. "
                "We have dispatched an emergency service alert for you."
            )

        return "Warning: Powertrain anomaly detected. Please drive with caution and inspect your vehicle."

    def send_gmail_alert(self, diagnosis: dict, raw_telemetry: dict, voice_script: str, active_owner: dict):
        fault_classes = [c for c in diagnosis.get("fault_classes", [0]) if c != 0]
        if not ENABLE_GMAIL_ALERTS or not fault_classes:
            return

        recipient_email = active_owner.get("email")
        chassis = active_owner.get("chassisNumber", raw_telemetry.get("chassis", "DEFAULT_CHASSIS"))
        if not recipient_email:
            return

        current_time = time.time()
        signature = "_".join(map(str, sorted(fault_classes)))
        cooldown_key = (chassis, signature)

        if current_time - self.last_email_sent_times.get(cooldown_key, 0) < self.EMAIL_COOLDOWN_SECONDS:
            return

        self.last_email_sent_times[cooldown_key] = current_time

        def _email_worker():
            try:
                if len(fault_classes) > 1:
                    subject = f"🚨 CRITICAL MULTI-FAULT ALERT: {len(fault_classes)} Powertrain Hazards on {chassis}"
                elif 3 in fault_classes:
                    subject = f"🚨 URGENT: Battery Thermal Overheat on {chassis}"
                elif 2 in fault_classes:
                    subject = f"⚡ Caution: Inverter Voltage Sag on {chassis}"
                else:
                    subject = f"⚠️ Notice: Motor Transmission Drag on {chassis}"

                v = raw_telemetry.get("Voltage", raw_telemetry.get("bus_voltage", 0.0))
                i = raw_telemetry.get("Current", raw_telemetry.get("current_amps", 0.0))
                t = raw_telemetry.get("Temperature", raw_telemetry.get("motor_temp", 0.0))
                rpm = raw_telemetry.get("motor_rpm", 0.0)

                owner_name = active_owner.get("fullName", "Vehicle Owner")
                vehicle_id = active_owner.get("vehicleId", "VEH-N/A")
                model_name = diagnosis.get("model_applied", "Electric Vehicle")

                html_body = f"""
                <html>
                  <body style="font-family: Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px;">
                    <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0;">
                      <h2 style="color: #0284c7; margin-top: 0;">VoltPulse AI Diagnostic Advisory</h2>
                      <p style="font-size: 14px; color: #334155;">Dear <strong>{owner_name}</strong>,</p>
                      
                      <div style="background-color: #fef2f2; padding: 14px; border-radius: 8px; border-left: 4px solid #e11d48; margin: 15px 0;">
                        <p style="font-size: 14px; line-height: 1.6; color: #9f1239; margin: 0; font-weight: bold;">
                          {voice_script}
                        </p>
                      </div>

                      <h4 style="color: #64748b; margin: 15px 0 8px 0; text-transform: uppercase; font-size: 11px;">Vehicle Specification:</h4>
                      <table style="width: 100%; font-size: 13px; color: #334155; margin-bottom: 15px;">
                        <tr><td><strong>Chassis VIN:</strong></td><td style="color: #0284c7; font-weight: bold; font-family: monospace;">{chassis}</td></tr>
                        <tr><td><strong>Vehicle Plate / ID:</strong></td><td>{vehicle_id}</td></tr>
                        <tr><td><strong>Vehicle Model:</strong></td><td style="color: #0d9488; font-weight: bold;">{model_name}</td></tr>
                        <tr><td><strong>Active State:</strong></td><td style="color: #e11d48; font-weight: bold;">{diagnosis.get('diagnosis_label')}</td></tr>
                      </table>

                      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
                      
                      <h4 style="color: #64748b; margin: 10px 0 8px 0; text-transform: uppercase; font-size: 11px;">Telemetry Snapshot:</h4>
                      <table style="width: 100%; font-size: 13px; color: #334155;">
                        <tr><td><strong>Battery Voltage:</strong></td><td>{v:.2f} V</td></tr>
                        <tr><td><strong>Power Draw:</strong></td><td>{i:.2f} A</td></tr>
                        <tr><td><strong>Battery Temperature:</strong></td><td style="color: #e11d48; font-weight: bold;">{t:.1f} °C</td></tr>
                        <tr><td><strong>Motor Speed:</strong></td><td>{rpm:.0f} RPM</td></tr>
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

                print(f"[Alert] Email dispatched to {recipient_email} for Chassis {chassis} ({model_name})")
            except Exception as e:
                print(f"[Email Error] Failed to send email to {recipient_email} ({chassis}): {e}")

        thread = threading.Thread(target=_email_worker, daemon=True)
        thread.start()

    def execute_service_booking(self, diagnosis: dict) -> dict:
        fault_classes = [c for c in diagnosis.get("fault_classes", [0]) if c != 0]
        if not fault_classes:
            return {"booking_required": False, "status": "No action needed"}

        if 3 in fault_classes:
            bay = "Thermal Isolation Emergency Bay 4"
        elif 2 in fault_classes:
            bay = "High-Voltage Electrical Bay 1"
        else:
            bay = "Mechanical Powertrain Bay 2"

        return {
            "booking_required": True,
            "booking_id": f"SRV-VP-{int(time.time()) % 10000}",
            "assigned_bay": bay,
            "slot_time": "Priority Emergency Service Allocated",
            "service_hub": "Bengaluru Central EV Service Hub",
        }


class MasterOrchestratorAgent:
    def __init__(self):
        self.diagnostic_agent = PredictiveDiagnosticAgent()
        self.outreach_agent = AutonomousOutreachAgent()

    def process_telemetry(self, raw_telemetry: dict, active_owner: dict = None) -> dict:
        if not active_owner:
            return None

        cal = active_owner.get("calibration", DEFAULT_DEMO_CALIBRATION)
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