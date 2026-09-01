import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)

for p in [current_dir, root_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

import cv2
from backend.app.ocr.easyocr_engine import EasyOCREngine
from backend.app.mrz.reconstruct import reconstruct_mrz_from_detections, normalize_mrz_td3
from backend.app.mrz.parser import parse_mrz

img_path = os.path.join(current_dir, "test_passport.jpg")
image = cv2.imread(img_path)

if image is None:
    raise RuntimeError(f"Could not load test_passport.jpg from {img_path}")

# Manual MRZ crop (bottom 30%)
h, w = image.shape[:2]
mrz_crop = image[int(h * 0.70):h, :]

ocr = EasyOCREngine()
raw_results = ocr.read(mrz_crop)

print("\n=======================================================")
print("=== STAGE 1: RAW EASYOCR DETECTIONS IN MRZ CROP ===")
print("=======================================================")
for item in raw_results:
    print(f"{item['text']!r:<45} confidence={item['confidence']:.3f}")

# Stage 2A: Raw Reconstructed
raw_line1, raw_line2 = reconstruct_mrz_from_detections(raw_results)
print("\n=======================================================")
print("=== STAGE 2A: RAW RECONSTRUCTED MRZ ===")
print("=======================================================")
print(f"RAW LINE 1: {raw_line1}")
print(f"RAW LINE 2: {raw_line2}")

# Stage 2B: Normalized MRZ
norm_line1, norm_line2 = normalize_mrz_td3(raw_line1, raw_line2)
print("\n=======================================================")
print("=== STAGE 2B: NORMALIZED MRZ (ICAO TD3) ===")
print("=======================================================")
print(f"NORM LINE 1: {norm_line1}")
print(f"NORM LINE 2: {norm_line2}")

# Stage 3: Parse and validate
print("\n=======================================================")
print("=== STAGE 3: PARSED PASSPORT FIELDS & CHECKSUMS ===")
print("=======================================================")
parsed = parse_mrz([norm_line1, norm_line2])
print(f"Document Number : {parsed.document_number}")
print(f"Surname         : {parsed.surname}")
print(f"Given Names     : {parsed.given_names}")
print(f"Full Name       : {parsed.full_name}")
print(f"Nationality     : {parsed.nationality}")
print(f"Date of Birth   : {parsed.date_of_birth} (raw: {parsed.raw_dob})")
print(f"Sex             : {parsed.sex}")
print(f"Date of Expiry  : {parsed.date_of_expiry} (raw: {parsed.raw_expiry})")
print(f"MRZ Valid       : {parsed.is_valid}")
print(f"Status          : {parsed.status}")

if parsed.errors:
    print("\nChecksum / Format Errors:")
    for err in parsed.errors:
        print(f" - {err}")

