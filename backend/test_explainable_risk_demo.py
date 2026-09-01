import os
import sys
import cv2
import numpy as np
from datetime import date

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)

for p in [current_dir, root_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.app.ocr.easyocr_engine import EasyOCREngine
from backend.app.ocr.viz_extractor import extract_viz_fields_from_ocr
from backend.app.ocr.cross_validation import cross_validate_viz_and_mrz
from backend.app.mrz.reconstruct import reconstruct_mrz_from_detections, normalize_mrz_td3
from backend.app.mrz.parser import parse_mrz
from backend.app.mrz.validation_rules import validate_document_rules
from backend.app.preprocessing.rectify import deskew_image
from backend.app.preprocessing.quality_gate import assess_capture_quality
from backend.app.tampering.detector import analyze_document_tampering
from backend.app.risk.explainable_engine import evaluate_screening_decision

ocr = EasyOCREngine()

def screen_and_report(img: np.ndarray, scenario_title: str, reference_date: date = date(2024, 6, 1)):
    print("\n" + "="*80)
    print(f"=== {scenario_title} ===")
    print("="*80)

    # 1. Quality Gate
    quality = assess_capture_quality(img)

    # 2. Deskew / Rectification
    rectified, _ = deskew_image(img)
    h, w = rectified.shape[:2]

    # 3. OCR
    all_ocr = ocr.read(rectified)

    # 4. VIZ
    viz = extract_viz_fields_from_ocr(all_ocr, rectified.shape)

    # 5. MRZ
    mrz_boxes = [
        b for b in all_ocr
        if min(p[1] for p in b["bbox"]) >= int(h * 0.68)
    ]
    r1, r2 = reconstruct_mrz_from_detections(mrz_boxes)
    n1, n2 = normalize_mrz_td3(r1, r2)
    mrz = parse_mrz([n1, n2])

    # 6. Cross-Validation
    cross_rep = cross_validate_viz_and_mrz(viz, mrz)

    # 7. Deterministic Document Validation (Expiration, Age, Checksums)
    doc_val = validate_document_rules(
        doc_number=mrz.document_number or viz.document_number,
        surname=mrz.surname or viz.surname,
        given_names=mrz.given_names or viz.given_names,
        nationality=mrz.nationality or viz.nationality,
        date_of_birth=mrz.date_of_birth or viz.date_of_birth,
        date_of_expiry=mrz.date_of_expiry or viz.date_of_expiry,
        sex=mrz.sex or viz.sex,
        mrz_valid=mrz.is_valid,
        current_reference_date=reference_date
    )

    # 8. Forensics
    forensics = analyze_document_tampering(rectified)

    # 9. Explainable Risk Decision
    decision_rep = evaluate_screening_decision(
        quality_res=quality,
        doc_validation_res=doc_val,
        cross_val_res=cross_rep,
        forensics_res=forensics,
        face_verified=True,
        face_similarity=0.94,
        face_live=True
    )

    # Display Explainable Output
    badge = {
        "LOW": "[LOW RISK - AUTHENTIC]",
        "MEDIUM": "[MEDIUM RISK - SUPERVISOR REVIEW]",
        "HIGH": "[HIGH RISK - SECURITY ALERT]",
        "INCONCLUSIVE": "[INCONCLUSIVE - RESCAN REQUIRED]"
    }.get(decision_rep.risk_level, decision_rep.risk_level)

    print(f"\nDECISION STATUS      : {badge}")
    print(f"TRUST SCORE          : {decision_rep.trust_score} / 100")
    print(f"OFFICIAL ACTION      : {decision_rep.decision}")
    print(f"RECOMMENDATION       : {decision_rep.recommended_action}")

    if decision_rep.risk_reasons:
        print("\nEXPLAINABLE REASONS FOR DECISION:")
        for r in decision_rep.risk_reasons:
            print(f" - {r}")
    else:
        print("\nEXPLAINABLE REASONS  : - No suspicious anomalies or data inconsistencies detected.")

    if decision_rep.advisory_notes:
        print("\nADVISORY NOTES:")
        for a in decision_rep.advisory_notes:
            print(f" - {a}")


if __name__ == "__main__":
    base_path = os.path.join(current_dir, "test_passport.jpg")
    base_img = cv2.imread(base_path)
    if base_img is None:
        raise RuntimeError(f"Cannot load {base_path}")

    # Scenario A: Genuine Authentic Passport (screening date: 2024-06-01, valid until 2031)
    screen_and_report(base_img.copy(), "SCENARIO A: GENUINE AUTHENTIC PASSPORT", date(2024, 6, 1))

    # Scenario B: Expired Passport (screening date: 2035-01-01, expired in 2031)
    screen_and_report(base_img.copy(), "SCENARIO B: EXPIRED PASSPORT (TEMPORAL CHECK)", date(2035, 1, 1))

    # Scenario C: Name Splicing / Identity Mismatch (VIZ modified to 'PRIYA SHARMA')
    img_forged_name = base_img.copy()
    patch = np.zeros((45, 200, 3), dtype=np.uint8) + 245
    cv2.putText(patch, "PRIYA SHARMA", (10, 30), cv2.FONT_HERSHEY_DUPLEX, 0.7, (10, 10, 10), 2)
    img_forged_name[355:400, 375:575] = patch
    screen_and_report(img_forged_name, "SCENARIO C: IDENTITY DATA MISMATCH (VIZ NAME MODIFIED)", date(2024, 6, 1))

    # Scenario D: Photo Replacement / Forensic Splicing
    img_spliced_photo = base_img.copy()
    photo_patch = np.random.randint(40, 220, (280, 220, 3), dtype=np.uint8)
    cv2.putText(photo_patch, "FORGED", (20, 140), cv2.FONT_HERSHEY_DUPLEX, 1.0, (255, 255, 255), 2)
    img_spliced_photo[160:440, 70:290] = photo_patch
    screen_and_report(img_spliced_photo, "SCENARIO D: PHOTO REPLACEMENT / FORENSIC SPLICING", date(2024, 6, 1))
