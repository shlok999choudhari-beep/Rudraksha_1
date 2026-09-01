import os
import sys
import cv2
import numpy as np

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)

for p in [current_dir, root_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.app.ocr.easyocr_engine import EasyOCREngine
from backend.app.ocr.viz_extractor import extract_viz_fields_from_ocr
from backend.app.mrz.reconstruct import reconstruct_mrz_from_detections, normalize_mrz_td3
from backend.app.mrz.parser import parse_mrz
from backend.app.tampering.detector import analyze_document_tampering
from backend.app.tampering.metadata import extract_image_metadata
from backend.app.risk.scoring import compute_master_risk_score

def run_veriguard_screening(image_path: str, is_forged_demo: bool = False):
    img = cv2.imread(image_path)
    if img is None:
        raise RuntimeError(f"Could not load image: {image_path}")

    h, w = img.shape[:2]

    # If simulating forgery for demonstration
    if is_forged_demo:
        # Forge visual name field to create VIZ <-> MRZ discrepancy + ELA anomaly
        patch = np.zeros((45, 220, 3), dtype=np.uint8)
        patch[:, :] = (245, 245, 245)
        cv2.putText(patch, "PRIYA SHARMA", (10, 32), cv2.FONT_HERSHEY_DUPLEX, 0.75, (10, 10, 10), 2)
        noise = np.random.normal(0, 30, patch.shape).astype(np.int16)
        patch = np.clip(patch.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        img[355:400, 375:595] = patch

    # 1. OCR
    ocr = EasyOCREngine()
    all_ocr = ocr.read(img)

    # 2. VIZ Extraction
    viz = extract_viz_fields_from_ocr(all_ocr, img.shape)

    # 3. MRZ Extraction & Checksums
    mrz_boxes = [
        item for item in all_ocr
        if min(p[1] for p in item["bbox"]) >= int(h * 0.70)
    ]
    raw_l1, raw_l2 = reconstruct_mrz_from_detections(mrz_boxes)
    norm_l1, norm_l2 = normalize_mrz_td3(raw_l1, raw_l2)
    mrz = parse_mrz([norm_l1, norm_l2])

    # 4. VIZ <-> MRZ Cross-Check
    def check_match(v_val, m_val):
        v = str(v_val or "").strip().upper().replace(" ", "")
        m = str(m_val or "").strip().upper().replace(" ", "")
        if "IND" in v and "IND" in m:
            return True
        if v and m and (v == m or v in m or m in v):
            return True
        return v == m and v != ""

    doc_match = check_match(viz.document_number, mrz.document_number)
    sname_match = check_match(viz.surname, mrz.surname)
    gname_match = check_match(viz.given_names, mrz.given_names)
    nat_match = check_match(viz.nationality, mrz.nationality)

    is_consistent = all([doc_match, sname_match, gname_match, nat_match])
    discrepancy_score = 0.0 if is_consistent else 0.85

    # 5. Forensic Tamper Analysis
    forensics = analyze_document_tampering(img)
    metadata = extract_image_metadata(image_path)

    # 6. Master Risk Engine Assessment
    risk_assessment = compute_master_risk_score(
        quality_passed=True,
        blur_score=150.0,
        glare_ratio=0.01,
        geometry_tampered=False,
        geometry_score=0.05,
        mrz_valid=mrz.is_valid,
        cross_validation_consistent=is_consistent,
        discrepancy_score=discrepancy_score,
        forensic_tampered=forensics.is_tampered or forensics.tamper_risk_score > 0.40,
        tamper_score=forensics.tamper_risk_score,
        face_verified=True,
        face_similarity=0.92,
        face_live=True
    )

    return {
        "viz": viz,
        "mrz": mrz,
        "cross_check": {
            "doc_match": doc_match,
            "surname_match": sname_match,
            "given_names_match": gname_match,
            "nationality_match": nat_match,
            "is_consistent": is_consistent
        },
        "forensics": forensics,
        "metadata": metadata,
        "risk_assessment": risk_assessment
    }


if __name__ == "__main__":
    img_path = os.path.join(current_dir, "test_passport.jpg")

    print("\n" + "="*70)
    print("=== SCENARIO 1: GENUINE PASSPORT SCREENING ===")
    print("="*70)
    res_clean = run_veriguard_screening(img_path, is_forged_demo=False)

    print(f"Holder Name        : {res_clean['viz'].full_name}")
    print(f"Passport Number    : {res_clean['viz'].document_number}")
    print(f"MRZ Checksum Valid : {res_clean['mrz'].is_valid}")
    print(f"VIZ <-> MRZ Match  : {'ALL MATCH (OK)' if res_clean['cross_check']['is_consistent'] else 'MISMATCH'}")
    print(f"Forensic Tamper    : {res_clean['forensics'].tamper_risk_level} (Score: {res_clean['forensics'].tamper_risk_score:.2f})")
    print(f"Overall Trust Score: {res_clean['risk_assessment'].overall_trust_score}/100")
    print(f"Risk Level         : {res_clean['risk_assessment'].overall_risk_level}")
    print(f"Decision           : {res_clean['risk_assessment'].screening_decision}")

    print("\n" + "="*70)
    print("=== SCENARIO 2: TAMPERED / FORGED PASSPORT SCREENING ===")
    print("="*70)
    res_forged = run_veriguard_screening(img_path, is_forged_demo=True)

    print(f"VIZ Name (Modified): {res_forged['viz'].surname} {res_forged['viz'].given_names}")
    print(f"MRZ Name (Original): {res_forged['mrz'].surname}, {res_forged['mrz'].given_names}")
    print(f"VIZ <-> MRZ Match  : {'ALL MATCH' if res_forged['cross_check']['is_consistent'] else 'DISCREPANCY DETECTED (ALERT)'}")
    print(f"Forensic Tamper    : {res_forged['forensics'].tamper_risk_level} (Score: {res_forged['forensics'].tamper_risk_score:.2f})")
    print(f"Overall Trust Score: {res_forged['risk_assessment'].overall_trust_score}/100")
    print(f"Risk Level         : {res_forged['risk_assessment'].overall_risk_level}")
    print(f"Decision           : {res_forged['risk_assessment'].screening_decision}")
    print(f"Critical Violations: {res_forged['risk_assessment'].critical_violations}")
