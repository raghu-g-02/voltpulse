import os

PORT = int(os.getenv("PORT", 8000))
HOST = os.getenv("HOST", "0.0.0.0")

FIREBASE_DATABASE_URL = os.getenv(
    "FIREBASE_DATABASE_URL",
    "https://major-pro-8b1c9-default-rtdb.asia-southeast1.firebasedatabase.app"
).rstrip("/")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "xgb_powertrain_classifier_1111.json")
METADATA_PATH = os.path.join(BASE_DIR, "models", "model_metadata_1111.json")

ENABLE_GMAIL_ALERTS = os.getenv("ENABLE_GMAIL_ALERTS", "True").lower() in ("true", "1", "yes")
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SENDER_GMAIL = os.getenv("SENDER_GMAIL", "bholenath11184@gmail.com")
SENDER_APP_PASSWORD = os.getenv("SENDER_APP_PASSWORD", "uaet oeoy idbf qyks").replace(" ", "")