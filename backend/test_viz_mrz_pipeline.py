import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)

for p in [current_dir, root_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

import cv2
from backend.app.ocr.easyocr_engine import EasyOCREngine
from backend.app.ocr.viz_extractor import extract_viz_fields_from_ocr
from backend.app.mrz.reconstruct import reconstruct_mrz_from_detections, normalize_mrz_td3
from backend.app.mrz.parser import parse_mrz

img_path = os.path.join(current_dir, "test_passport.jpg")
image = cv2.imread(img_path)

if image is None:
    raise RuntimeError(f"Could not load test_passport.jpg from {img_path}")

h, w = image.shape[:2]
ocr = EasyOCREngine()

# 1. Full document OCR
print("\n=======================================================")
print("=== 1. RUNNING FULL DOCUMENT EASYOCR ===")
print("=======================================================")
all_results = ocr.read(image)
print(f"Total detected OCR boxes: {len(all_results)}")

# 2. Extract VIZ Fields
print("\n=======================================================")
print("=== 2. EXTRACTED VIZ FIELDS (HUMAN-READABLE ZONE) ===")
print("=======================================================")
viz = extract_viz_fields_from_ocr(all_results, image.shape)
print(f"Document Number : {viz.document_number}")
print(f"Surname         : {viz.surname}")
print(f"Given Names     : {viz.given_names}")
print(f"Full Name       : {viz.full_name}")
print(f"Nationality     : {viz.nationality}")
print(f"Date of Birth   : {viz.date_of_birth}")
print(f"Date of Expiry  : {viz.date_of_expiry}")
print(f"Sex             : {viz.sex}")

# 3. Extract & Reconstruct MRZ
print("\n=======================================================")
print("=== 3. EXTRACTED & NORMALIZED MRZ DATA ===")
print("=======================================================")
mrz_crop_boxes = [
    item for item in all_results
    if min(p[1] for p in item["bbox"]) >= int(h * 0.70)
]

raw_line1, raw_line2 = reconstruct_mrz_from_detections(mrz_crop_boxes)
norm_line1, norm_line2 = normalize_mrz_td3(raw_line1, raw_line2)
mrz = parse_mrz([norm_line1, norm_line2])

print(f"NORM LINE 1     : {norm_line1}")
print(f"NORM LINE 2     : {norm_line2}")
print(f"MRZ Doc Number  : {mrz.document_number}")
print(f"MRZ Surname     : {mrz.surname}")
print(f"MRZ Given Names : {mrz.given_names}")
print(f"MRZ Full Name   : {mrz.full_name}")
print(f"MRZ Nationality : {mrz.nationality}")
print(f"MRZ DOB         : {mrz.date_of_birth}")
print(f"MRZ Expiry      : {mrz.date_of_expiry}")
print(f"MRZ Sex         : {mrz.sex}")
print(f"MRZ Checksums   : {'VALID' if mrz.is_valid else 'INVALID'}")

# 4. Cross-Validation (VIZ <-> MRZ)
print("\n=======================================================")
print("=== 4. VIZ <-> MRZ CROSS-CHECK AUDIT REPORT ===")
print("=======================================================")

def check_match(label, viz_val, mrz_val):
    # Normalize strings for comparison
    v = str(viz_val or "").strip().upper().replace(" ", "")
    m = str(mrz_val or "").strip().upper().replace(" ", "")
    
    # Handle country code (e.g. INDIAN vs IND)
    if "IND" in v and "IND" in m:
        is_match = True
    elif v and m and (v == m or v in m or m in v):
        is_match = True
    else:
        is_match = (v == m and v != "")

    status = "MATCH [OK]" if is_match else "MISMATCH [ALERT]"
    print(f" {label:<18} | VIZ: {str(viz_val):<15} | MRZ: {str(mrz_val):<15} | {status}")
    return is_match

c1 = check_match("Document Number", viz.document_number, mrz.document_number)
c2 = check_match("Surname", viz.surname, mrz.surname)
c3 = check_match("Given Names", viz.given_names, mrz.given_names)
c4 = check_match("Nationality", viz.nationality, mrz.nationality)
c5 = check_match("Sex", viz.sex, mrz.sex)

all_matched = all([c1, c2, c3, c4])
print("-------------------------------------------------------")
print(f"Overall Identity Verification Verdict: {'VERIFIED [AUTHENTIC]' if all_matched else 'REFER [DISCREPANCY DETECTED]'}")
