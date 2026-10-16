import os

# Firebase Realtime Database URL
FIREBASE_DATABASE_URL = "https://major-pro-8b1c9-default-rtdb.asia-southeast1.firebasedatabase.app/"

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "xgb_powertrain_classifier_1111.json")
METADATA_PATH = os.path.join(BASE_DIR, "models", "model_metadata_1111.json")

# ==============================================================================
# GMAIL NOTIFICATION CONFIGURATION
# ==============================================================================
ENABLE_GMAIL_ALERTS = True
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 465  # SSL Port

# Sender credentials (your service account or notification bot)
SENDER_GMAIL = "bholenath11184@gmail.com"
SENDER_APP_PASSWORD = "uaet oeoy idbf qyks"  # 16-character App Password from Google Security