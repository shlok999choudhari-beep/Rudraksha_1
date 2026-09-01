import os
import sys
import cv2
import numpy as np
from typing import Dict, Any, List

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
from backend.app.preprocessing.rectify import deskew_image
from backend.app.preprocessing.quality_gate import assess_capture_quality
from backend.app.tampering.detector import analyze_document_tampering
from backend.app.risk.scoring import compute_master_risk_score

ocr_engine = EasyOCREngine()

def evaluate_image(img: np.ndarray, scenario_id: str, description: str, expected_type: str) -> Dict[str, Any]:
    # 1. Quality Gate Check
    quality = assess_capture_quality(img)
    if not quality.is_acceptable:
        return {
            "id": scenario_id,
            "description": description,
            "expected": expected_type,
            "viz_name": "N/A",
            "mrz_name": "N/A",
            "mrz_valid": False,
            "viz_mrz_match": False,
            "forensic_level": "INCONCLUSIVE",
            "trust_score": 0.0,
            "risk_level": "RESCAN_REQUIRED",
            "decision": "RESCAN_REQUIRED_POOR_QUALITY"
        }

    # 2. Document Auto-Deskew / Geometry Rectification
    rectified_img, deskew_angle = deskew_image(img)
    h, w = rectified_img.shape[:2]

    # 3. OCR on Rectified Image
    all_ocr = ocr_engine.read(rectified_img)

    # 4. VIZ Extraction
    viz = extract_viz_fields_from_ocr(all_ocr, rectified_img.shape)

    # 5. MRZ Extraction
    mrz_boxes = [
        item for item in all_ocr
        if min(p[1] for p in item["bbox"]) >= int(h * 0.68)
    ]
    raw_l1, raw_l2 = reconstruct_mrz_from_detections(mrz_boxes)
    norm_l1, norm_l2 = normalize_mrz_td3(raw_l1, raw_l2)
    mrz = parse_mrz([norm_l1, norm_l2])

    # 6. Comprehensive Field-by-Field Cross-Validation (Doc, Names, DOB, Expiry, Nat)
    cross_rep = cross_validate_viz_and_mrz(viz, mrz)

    # 7. Forensics
    forensics = analyze_document_tampering(rectified_img)

    # 8. Multi-Layer Risk Decision
    is_tampered_forensic = forensics.is_tampered or forensics.tamper_risk_score > 0.40
    risk = compute_master_risk_score(
        quality_passed=quality.is_acceptable,
        blur_score=quality.blur_score,
        glare_ratio=quality.glare_score,
        geometry_tampered=False,
        geometry_score=0.05,
        mrz_valid=mrz.is_valid,
        cross_validation_consistent=cross_rep.is_consistent,
        discrepancy_score=cross_rep.discrepancy_score,
        forensic_tampered=is_tampered_forensic,
        tamper_score=forensics.tamper_risk_score,
        face_verified=True,
        face_similarity=0.92,
        face_live=True
    )

    return {
        "id": scenario_id,
        "description": description,
        "expected": expected_type,
        "viz_name": f"{viz.given_names} {viz.surname}".strip(),
        "mrz_name": f"{mrz.given_names} {mrz.surname}".strip(),
        "mrz_valid": mrz.is_valid,
        "viz_mrz_match": cross_rep.is_consistent,
        "forensic_level": forensics.tamper_risk_level,
        "trust_score": risk.overall_trust_score,
        "risk_level": risk.overall_risk_level,
        "decision": risk.screening_decision
    }


def run_robustness_matrix():
    base_path = os.path.join(current_dir, "test_passport.jpg")
    base_img = cv2.imread(base_path)
    if base_img is None:
        raise RuntimeError(f"Cannot load {base_path}")

    h, w = base_img.shape[:2]
    results = []

    print("\n" + "="*80)
    print("=== EXECUTING VERIGUARD ROBUSTNESS EVALUATION MATRIX (16 TEST SCENARIOS) ===")
    print("="*80)

    # -------------------------------------------------------------
    # GENUINE SCENARIOS (G1 - G8)
    # -------------------------------------------------------------
    print("\n--- Running Genuine Test Suite (G1..G8) ---")

    # G1: Clean Baseline
    print("Testing G1: Clean Baseline...")
    results.append(evaluate_image(base_img.copy(), "G1", "Clean Baseline Passport", "GENUINE"))

    # G2: Slight 2.5 degree rotation
    print("Testing G2: 2.5 deg Rotation...")
    M_rot = cv2.getRotationMatrix2D((w / 2, h / 2), 2.5, 1.0)
    g2_img = cv2.warpAffine(base_img, M_rot, (w, h), borderMode=cv2.BORDER_REPLICATE)
    results.append(evaluate_image(g2_img, "G2", "Slight Rotation (+2.5 deg)", "GENUINE"))

    # G3: Perspective Tilt
    print("Testing G3: Perspective Skew...")
    src_pts = np.float32([[0, 0], [w, 0], [0, h], [w, h]])
    dst_pts = np.float32([[15, 10], [w - 10, 5], [5, h - 10], [w - 20, h - 5]])
    M_persp = cv2.getPerspectiveTransform(src_pts, dst_pts)
    g3_img = cv2.warpPerspective(base_img, M_persp, (w, h), borderMode=cv2.BORDER_REPLICATE)
    results.append(evaluate_image(g3_img, "G3", "Perspective Tilt Skew", "GENUINE"))

    # G4: Lighting Gradient
    print("Testing G4: Illumination Gradient...")
    g4_img = base_img.copy().astype(np.float32)
    gradient = np.tile(np.linspace(0.85, 1.15, w), (h, 1))
    for c in range(3):
        g4_img[:, :, c] = np.clip(g4_img[:, :, c] * gradient, 0, 255)
    results.append(evaluate_image(g4_img.astype(np.uint8), "G4", "Illumination Gradient", "GENUINE"))

    # G5: Mild Gaussian Blur
    print("Testing G5: Mild Gaussian Blur (sigma=1.0)...")
    g5_img = cv2.GaussianBlur(base_img, (3, 3), 1.0)
    results.append(evaluate_image(g5_img, "G5", "Mild Blur (sigma=1.0)", "GENUINE"))

    # G6: Downscaled / Re-upscaled (Low resolution scan)
    print("Testing G6: Low Resolution Downsample/Upsample...")
    g6_img = cv2.resize(cv2.resize(base_img, (w // 2, h // 2)), (w, h), interpolation=cv2.INTER_CUBIC)
    results.append(evaluate_image(g6_img, "G6", "Low-Res 0.5x Scan", "GENUINE"))

    # G7: Heavy JPEG Compression
    print("Testing G7: Heavy JPEG Recompression (Q=60)...")
    _, enc = cv2.imencode(".jpg", base_img, [int(cv2.IMWRITE_JPEG_QUALITY), 60])
    g7_img = cv2.imdecode(enc, cv2.IMREAD_COLOR)
    results.append(evaluate_image(g7_img, "G7", "JPEG Compression (Q=60)", "GENUINE"))

    # G8: Second Alternate Identity Passport
    print("Testing G8: Second Identity Passport...")
    g8_path = os.path.join(root_dir, "data", "synthetic", "passport_shlok_choudhari.jpg")
    g8_img = cv2.imread(g8_path) if os.path.exists(g8_path) else base_img
    results.append(evaluate_image(g8_img, "G8", "Alternate Identity (Shlok C.)", "GENUINE"))

    # -------------------------------------------------------------
    # FORGED SCENARIOS (F1 - F8)
    # -------------------------------------------------------------
    print("\n--- Running Forged Test Suite (F1..F8) ---")

    # F1: Name Tampered in VIZ
    print("Testing F1: VIZ Name Tampered...")
    f1_img = base_img.copy()
    patch = np.zeros((45, 200, 3), dtype=np.uint8) + 245
    cv2.putText(patch, "PRIYA SHARMA", (10, 30), cv2.FONT_HERSHEY_DUPLEX, 0.7, (10, 10, 10), 2)
    f1_img[355:400, 375:575] = patch
    results.append(evaluate_image(f1_img, "F1", "VIZ Name Modified (Priya)", "FORGED"))

    # F2: DOB Tampered in VIZ
    print("Testing F2: VIZ DOB Tampered...")
    f2_img = base_img.copy()
    patch = np.zeros((30, 160, 3), dtype=np.uint8) + 245
    cv2.putText(patch, "01 JAN 1990", (5, 22), cv2.FONT_HERSHEY_DUPLEX, 0.65, (10, 10, 10), 2)
    f2_img[255:285, 775:935] = patch
    results.append(evaluate_image(f2_img, "F2", "VIZ DOB Modified (1990)", "FORGED"))

    # F3: Passport Number Modified in VIZ
    print("Testing F3: VIZ Passport Number Modified...")
    f3_img = base_img.copy()
    patch = np.zeros((30, 150, 3), dtype=np.uint8) + 245
    cv2.putText(patch, "Z99999999", (5, 22), cv2.FONT_HERSHEY_DUPLEX, 0.7, (10, 10, 10), 2)
    f3_img[310:340, 375:525] = patch
    results.append(evaluate_image(f3_img, "F3", "VIZ Doc Number Modified (Z999)", "FORGED"))

    # F4: Expiry Date Modified in VIZ
    print("Testing F4: VIZ Expiry Date Modified...")
    f4_img = base_img.copy()
    patch = np.zeros((30, 160, 3), dtype=np.uint8) + 245
    cv2.putText(patch, "25 DEC 2040", (5, 22), cv2.FONT_HERSHEY_DUPLEX, 0.65, (10, 10, 10), 2)
    f4_img[420:450, 775:935] = patch
    results.append(evaluate_image(f4_img, "F4", "VIZ Expiry Date Modified (2040)", "FORGED"))

    # F5: MRZ Checksum Corrupted (Line 2 check digit altered)
    print("Testing F5: MRZ Checksum Corrupted...")
    f5_img = base_img.copy()
    patch = np.zeros((35, 60, 3), dtype=np.uint8) + 245
    cv2.putText(patch, "9", (10, 26), cv2.FONT_HERSHEY_DUPLEX, 0.8, (10, 10, 10), 2)
    f5_img[765:800, 240:300] = patch  # corrupt check digit area in MRZ
    results.append(evaluate_image(f5_img, "F5", "MRZ Checksum Corrupted", "FORGED"))

    # F6: Photo Box Spliced / Replaced
    print("Testing F6: Photo Box Spliced...")
    f6_img = base_img.copy()
    # Insert foreign face patch with high edge discrepancy
    photo_patch = np.random.randint(50, 200, (300, 240, 3), dtype=np.uint8)
    cv2.putText(photo_patch, "SPLICED", (20, 150), cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 3)
    f6_img[150:450, 60:300] = photo_patch
    results.append(evaluate_image(f6_img, "F6", "Photo Box Spliced", "FORGED"))

    # F7: High Noise Spliced Text Patch
    print("Testing F7: Noisy Text Splice...")
    f7_img = base_img.copy()
    noisy_patch = np.zeros((40, 180, 3), dtype=np.uint8) + 230
    cv2.putText(noisy_patch, "FORGED", (10, 28), cv2.FONT_HERSHEY_DUPLEX, 0.8, (0, 0, 0), 2)
    noise = np.random.normal(0, 45, noisy_patch.shape).astype(np.int16)
    noisy_patch = np.clip(noisy_patch.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    f7_img[360:400, 380:560] = noisy_patch
    results.append(evaluate_image(f7_img, "F7", "Noisy Spliced Text Patch", "FORGED"))

    # F8: Copy-Move Cloned Stamp
    print("Testing F8: Copy-Move Cloned Region...")
    f8_img = base_img.copy()
    # Clone stamp/crest to another region
    f8_img[200:270, 600:670] = base_img[100:170, 100:170]
    results.append(evaluate_image(f8_img, "F8", "Copy-Move Cloned Stamp", "FORGED"))

    # -------------------------------------------------------------
    # FORMAT RESULTS TABLE
    # -------------------------------------------------------------
    print("\n" + "="*110)
    print(f"{'ID':<4} | {'Scenario Description':<32} | {'Expected':<8} | {'VIZ-MRZ':<8} | {'MRZ-Chk':<8} | {'Trust':<6} | {'Risk Level':<10} | {'Clearance Decision'}")
    print("="*110)

    for r in results:
        match_str = "MATCH" if r["viz_mrz_match"] else "MISMATCH"
        chk_str = "PASS" if r["mrz_valid"] else "FAIL"
        print(f"{r['id']:<4} | {r['description']:<32} | {r['expected']:<8} | {match_str:<8} | {chk_str:<8} | {r['trust_score']:<6.1f} | {r['risk_level']:<10} | {r['decision']}")

    print("="*110)

    # Summary Statistics
    tp = sum(1 for r in results if r["expected"] == "FORGED" and r["risk_level"] in ["HIGH", "CRITICAL"])
    fn = sum(1 for r in results if r["expected"] == "FORGED" and r["risk_level"] not in ["HIGH", "CRITICAL"])
    tn = sum(1 for r in results if r["expected"] == "GENUINE" and r["risk_level"] in ["LOW", "MEDIUM"])
    fp = sum(1 for r in results if r["expected"] == "GENUINE" and r["risk_level"] not in ["LOW", "MEDIUM"])

    print(f"\nRobustness Evaluation Summary:")
    print(f" - True Positives (Forged correctly flagged as HIGH risk)  : {tp}/8")
    print(f" - False Negatives (Forged missed / low risk)              : {fn}/8")
    print(f" - True Negatives (Genuine cleared / low-med risk)         : {tn}/8")
    print(f" - False Positives (Genuine rejected as HIGH risk)         : {fp}/8")


if __name__ == "__main__":
    run_robustness_matrix()
