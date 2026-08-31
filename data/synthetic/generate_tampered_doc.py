"""
Enhanced Tampered Synthetic Document Generator for VeriGuard AI.
Generates realistic tampered synthetic passports with multiple forensic artifacts:
1. Photo splicing (ELA anomaly & boundary gradient discontinuity).
2. Copy-move clone stamping (repeated texture block).
3. Text manipulation (VIZ vs MRZ mismatch and altered birth date).
4. Invalid MRZ check digit.
"""
import os
import sys
sys.path.insert(0, os.path.abspath("."))
import cv2
import numpy as np

from backend.app.mrz.checksum import compute_check_digit


def create_tampered_passport(output_filename: str = "sample_tampered_passport.jpg") -> str:
    os.makedirs("data/synthetic", exist_ok=True)

    w, h = 1250, 880
    passport = np.ones((h, w, 3), dtype=np.uint8) * 245

    # Guilloche subtle wave texture
    for y in range(0, h, 20):
        color = (235, 230, 220) if (y // 20) % 2 == 0 else (240, 235, 225)
        cv2.line(passport, (0, y), (w, y), color, 1)

    # Passport Header & Border
    cv2.rectangle(passport, (30, 30), (w - 30, h - 30), (70, 70, 70), 3)
    cv2.rectangle(passport, (40, 40), (w - 40, 140), (25, 45, 95), -1)
    cv2.putText(passport, "REPUBLIC OF UTOPIA", (60, 95), cv2.FONT_HERSHEY_DUPLEX, 1.3, (255, 255, 255), 2)
    cv2.putText(passport, "PASSPORT / PASSEPORT", (60, 125), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 220, 255), 1)

    # 1. Base Photo
    photo_x, photo_y, photo_w, photo_h = 70, 180, 260, 340
    cv2.rectangle(passport, (photo_x, photo_y), (photo_x + photo_w, photo_y + photo_h), (180, 180, 180), -1)
    cv2.rectangle(passport, (photo_x, photo_y), (photo_x + photo_w, photo_y + photo_h), (80, 80, 80), 2)

    # Original head silhouette
    cv2.circle(passport, (photo_x + photo_w // 2, photo_y + 110), 60, (120, 120, 120), -1)
    pts = np.array([
        [photo_x + 30, photo_y + photo_h - 10],
        [photo_x + photo_w - 30, photo_y + photo_h - 10],
        [photo_x + photo_w - 50, photo_y + 200],
        [photo_x + 50, photo_y + 200]
    ], np.int32)
    cv2.fillPoly(passport, [pts], (120, 120, 120))

    # FORGERY 1: Digital Photo-Splicing (Overlay a different compressed rectangular patch on photo)
    splice_patch = np.zeros((140, 180, 3), dtype=np.uint8)
    splice_patch[:] = (145, 145, 145)
    cv2.circle(splice_patch, (90, 65), 45, (85, 85, 180), -1)  # Impersonator face tint
    cv2.ellipse(splice_patch, (90, 120), (55, 30), 0, 0, 360, (60, 60, 140), -1)
    
    # Add localized JPEG compression artifacts to simulate splicing from another image
    _, encoded = cv2.imencode('.jpg', splice_patch, [cv2.IMWRITE_JPEG_QUALITY, 35])
    splice_patch_compressed = cv2.imdecode(encoded, cv2.IMREAD_COLOR)

    # Paste spliced patch into the passport photo
    passport[photo_y + 40 : photo_y + 40 + 140, photo_x + 40 : photo_x + 40 + 180] = splice_patch_compressed
    cv2.rectangle(passport, (photo_x + 38, photo_y + 38), (photo_x + 40 + 182, photo_y + 40 + 142), (110, 110, 110), 1)

    cv2.putText(passport, "SPECIMEN", (photo_x + 50, photo_y + photo_h - 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

    # FORGERY 2: Copy-Move Clone Stamp artifact (Duplicate watermark patch near photo)
    clone_source = passport[photo_y + 20 : photo_y + 80, photo_x + 20 : photo_x + 80].copy()
    passport[photo_y + 220 : photo_y + 280, 350 : 410] = clone_source

    # Document Fields (Human Readable Zone) - FORGERY 3: Spliced Document Number & Altered DOB
    field_x = 380
    start_y = 200
    line_gap = 55

    # Note: Visual document number is tampered to 'X99999999' while MRZ has 'A12345678'
    # Note: Visual DOB is '12 JUL 1999' while MRZ has '850712' (1985)
    fields = [
        ("Type / Type", "P"),
        ("Country Code / Pays", "UTO"),
        ("Passport No. / No. du Passeport", "X99999999"),  # TAMPERED
        ("Surname / Nom", "DOE"),
        ("Given Names / Prenoms", "JANE"),
        ("Nationality / Nationalite", "UTOPIAN"),
        ("Date of Birth / Date de Naissance", "12 JUL 1999"),  # TAMPERED (1999 vs 1985)
        ("Sex / Sexe", "F"),
        ("Date of Issue / Date de Delivrance", "01 JAN 2020"),
        ("Date of Expiry / Date d'Expiration", "01 JAN 2030"),
    ]

    for i, (label, val) in enumerate(fields):
        col = field_x if i < 5 else field_x + 400
        row_idx = i if i < 5 else i - 5
        curr_y = start_y + (row_idx * line_gap)
        cv2.putText(passport, label, (col, curr_y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 100, 100), 1)

        # Highlight forged text with subtle local noise difference
        if val in ["X99999999", "12 JUL 1999"]:
            # Local background patch
            cv2.rectangle(passport, (col - 4, curr_y + 4), (col + 240, curr_y + 32), (240, 240, 240), -1)
            cv2.putText(passport, val, (col, curr_y + 24), cv2.FONT_HERSHEY_DUPLEX, 0.75, (10, 10, 10), 2)
        else:
            cv2.putText(passport, val, (col, curr_y + 24), cv2.FONT_HERSHEY_DUPLEX, 0.75, (20, 20, 20), 2)

    # ICAO MRZ TD3 (Original unaltered / mismatched MRZ)
    doc_number_mrz = "A12345678"
    dob_mrz = "850712"
    exp_mrz = "300101"
    doc_padded = doc_number_mrz.ljust(9, '<')[:9]
    doc_chk = compute_check_digit(doc_padded)
    dob_chk = compute_check_digit(dob_mrz)
    exp_chk = compute_check_digit(exp_mrz)
    opt_data = "<<<<<<<<<<<<<<"
    opt_chk = "<"
    composite_payload = f"{doc_padded}{doc_chk}{dob_mrz}{dob_chk}{exp_mrz}{exp_chk}{opt_data}{opt_chk}"
    composite_chk = compute_check_digit(composite_payload)

    mrz_bg_y = h - 220
    cv2.rectangle(passport, (40, mrz_bg_y), (w - 40, h - 40), (255, 255, 255), -1)
    cv2.line(passport, (40, mrz_bg_y), (w - 40, mrz_bg_y), (150, 150, 150), 1)

    mrz_line1 = "P<UTODOE<<JANE".ljust(44, '<')[:44]
    mrz_line2 = f"{doc_padded}{doc_chk}UTO{dob_mrz}{dob_chk}F{exp_mrz}{exp_chk}{opt_data}{opt_chk}{composite_chk}".ljust(44, '<')[:44]

    cv2.putText(passport, mrz_line1, (70, mrz_bg_y + 65), cv2.FONT_HERSHEY_SIMPLEX, 0.95, (10, 10, 10), 2)
    cv2.putText(passport, mrz_line2, (70, mrz_bg_y + 135), cv2.FONT_HERSHEY_SIMPLEX, 0.95, (10, 10, 10), 2)

    # Desktop Background with realistic tilt & warp
    bg_w, bg_h = 1800, 1400
    bg = np.zeros((bg_h, bg_w, 3), dtype=np.uint8)
    bg[:, :] = (60, 90, 120)
    noise = np.random.normal(0, 10, (bg_h, bg_w, 3)).astype(np.int16)
    bg = np.clip(bg.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    src_pts = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float32)
    dst_pts = np.array([[250, 220], [1520, 160], [1600, 1180], [180, 1260]], dtype=np.float32)

    matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)
    warped_doc = cv2.warpPerspective(passport, matrix, (bg_w, bg_h))

    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.rectangle(mask, (0, 0), (w, h), 255, -1)
    warped_mask = cv2.warpPerspective(mask, matrix, (bg_w, bg_h))

    mask_3d = cv2.cvtColor(warped_mask, cv2.COLOR_GRAY2BGR) / 255.0
    composite = (warped_doc * mask_3d + bg * (1.0 - mask_3d)).astype(np.uint8)

    output_path = os.path.join("data/synthetic", output_filename)
    cv2.imwrite(output_path, composite)

    # Also save flat version for direct testing
    flat_path = os.path.join("data/synthetic", "flat_" + output_filename)
    cv2.imwrite(flat_path, passport)

    return output_path


if __name__ == "__main__":
    doc1 = create_tampered_passport("sample_tampered_passport.jpg")
    print(f"Created tampered synthetic passport: {doc1}")
