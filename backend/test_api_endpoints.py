import os
import sys
import io
import cv2
import numpy as np

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)

for p in [current_dir, root_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

print("\n=======================================================")
print("=== 1. TESTING GET /health AND GET /api/v1/health ===")
print("=======================================================")
resp_h1 = client.get("/health")
print(f"GET /health        -> Status: {resp_h1.status_code}, Body: {resp_h1.json()}")
assert resp_h1.status_code == 200

resp_h2 = client.get("/api/v1/health")
print(f"GET /api/v1/health -> Status: {resp_h2.status_code}, Body: {resp_h2.json()}")
assert resp_h2.status_code == 200

print("\n=======================================================")
print("=== 2. TESTING POST /api/v1/screen (GENUINE DOCUMENT) ===")
print("=======================================================")
passport_path = os.path.join(current_dir, "test_passport.jpg")
with open(passport_path, "rb") as f:
    file_bytes = f.read()

resp_gen = client.post(
    "/api/v1/screen",
    files={"file": ("passport.jpg", file_bytes, "image/jpeg")}
)

print(f"POST /api/v1/screen Status: {resp_gen.status_code}")
gen_json = resp_gen.json()
print(f"Decision           : {gen_json.get('decision')}")
print(f"Trust Score        : {gen_json.get('trust_score')}")
print(f"Name               : {gen_json.get('identity', {}).get('name')}")
print(f"Passport No.       : {gen_json.get('identity', {}).get('passport_number')}")
print(f"MRZ Valid          : {gen_json.get('mrz', {}).get('valid')}")
print(f"VIZ <-> MRZ Match  : {gen_json.get('cross_validation', {}).get('is_consistent')}")
assert resp_gen.status_code == 200

print("\n=======================================================")
print("=== 3. TESTING POST /api/v1/screen (FORGED NAME) ===")
print("=======================================================")
# Create forged image in memory
raw_img = cv2.imread(passport_path)
patch = np.zeros((45, 200, 3), dtype=np.uint8) + 245
cv2.putText(patch, "PRIYA SHARMA", (10, 30), cv2.FONT_HERSHEY_DUPLEX, 0.7, (10, 10, 10), 2)
raw_img[355:400, 375:575] = patch
_, forged_enc = cv2.imencode(".jpg", raw_img)

resp_forged = client.post(
    "/api/v1/screen",
    files={"file": ("forged_passport.jpg", forged_enc.tobytes(), "image/jpeg")}
)

print(f"POST /api/v1/screen Status: {resp_forged.status_code}")
forged_json = resp_forged.json()
print(f"Decision           : {forged_json.get('decision')}")
print(f"Risk Level         : {forged_json.get('risk_level')}")
print(f"Trust Score        : {forged_json.get('trust_score')}")
print(f"VIZ <-> MRZ Match  : {forged_json.get('cross_validation', {}).get('is_consistent')}")
print(f"Risk Reasons       : {forged_json.get('risk_reasons')}")
assert resp_forged.status_code == 200
assert forged_json.get('decision') == "SECONDARY_INSPECTION_REQUIRED"

print("\n=======================================================")
print("=== ALL API ENDPOINTS VERIFIED SUCCESSFULLY ===")
print("=======================================================")
