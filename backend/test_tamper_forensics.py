import os
import sys
import cv2
import numpy as np

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)

for p in [current_dir, root_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.app.tampering.detector import analyze_document_tampering
from backend.app.tampering.metadata import extract_image_metadata

# 1. Test Genuine Document
genuine_path = os.path.join(current_dir, "test_passport.jpg")
genuine_img = cv2.imread(genuine_path)

if genuine_img is None:
    raise RuntimeError(f"Could not load genuine passport from {genuine_path}")

print("\n=======================================================")
print("=== 1. TESTING GENUINE DOCUMENT FORENSICS ===")
print("=======================================================")
genuine_rep = analyze_document_tampering(genuine_img)
genuine_meta = extract_image_metadata(genuine_path)

print(f"Tampered Verdict    : {genuine_rep.is_tampered}")
print(f"Tamper Risk Score   : {genuine_rep.tamper_risk_score:.3f} ({genuine_rep.tamper_risk_level})")
print(f"ELA Anomaly Score   : {genuine_rep.ela_result.anomaly_score:.3f}")
print(f"Noise Inconsistency : {genuine_rep.noise_result.noise_anomaly_score:.3f}")
print(f"Copy-Move Clones    : {len(genuine_rep.copy_move_result.cloned_pairs)} clone pairs detected")
print(f"Tampering Flags     : {genuine_rep.tampering_flags or 'None'}")
print(f"Metadata Software   : {genuine_meta.get('software') or 'Clean (None)'}")

# 2. Create Simulated Spliced Document (Tampered)
# Copy a patch from one area to another and apply foreign compression
tampered_img = genuine_img.copy()
h, w = tampered_img.shape[:2]

# Forge name field with foreign noisy patch
patch = np.zeros((45, 200, 3), dtype=np.uint8)
patch[:, :] = (240, 240, 240)
cv2.putText(patch, "FORGED_DOE", (10, 32), cv2.FONT_HERSHEY_DUPLEX, 0.8, (10, 10, 10), 2)
# Add high noise to patch to simulate multi-source splice
noise = np.random.normal(0, 25, patch.shape).astype(np.int16)
patch = np.clip(patch.astype(np.int16) + noise, 0, 255).astype(np.uint8)
tampered_img[355:400, 380:580] = patch

# Also clone a badge/stamp to simulate copy-move forgery
tampered_img[200:240, 600:640] = tampered_img[200:240, 100:140]

print("\n=======================================================")
print("=== 2. TESTING TAMPERED / SPLICED DOCUMENT FORENSICS ===")
print("=======================================================")
tampered_rep = analyze_document_tampering(tampered_img)

print(f"Tampered Verdict    : {tampered_rep.is_tampered}")
print(f"Tamper Risk Score   : {tampered_rep.tamper_risk_score:.3f} ({tampered_rep.tamper_risk_level})")
print(f"ELA Anomaly Score   : {tampered_rep.ela_result.anomaly_score:.3f}")
print(f"Noise Inconsistency : {tampered_rep.noise_result.noise_anomaly_score:.3f}")
print(f"Copy-Move Clones    : {len(tampered_rep.copy_move_result.cloned_pairs)} clone pairs detected")
print(f"Tampering Flags     : {tampered_rep.tampering_flags}")
print(f"Recommendation      : {tampered_rep.recommendation}")
