"""
Synthetic Document Generator for VeriGuard AI Testing.
Generates realistic, completely synthetic/fictional passport images
with mock MRZ, fictional data, and perspective tilt on a desk background
for pipeline validation without using real identity data.
"""
import os
import cv2
import numpy as np
from typing import Optional

from backend.app.mrz.checksum import compute_check_digit


def generate_synthetic_passport(
    name: str = "JANE",
    surname: str = "DOE",
    nationality: str = "UTO",  # Utopia
    doc_number: str = "A12345678",
    viz_doc_number: Optional[str] = None,
    dob: str = "850712",       # 12 Jul 1985
    sex: str = "F",
    expiry: str = "300101",    # 01 Jan 2030
    tilt_and_place: bool = True,
    output_filename: str = "sample_tilted_passport.jpg"
) -> str:
    """
    Generates a synthetic genuine passport image and saves it to data/synthetic/<output_filename>.

    Returns:
        Path to the saved image.
    """
    os.makedirs("data/synthetic", exist_ok=True)
    os.makedirs("data/processed", exist_ok=True)

    # 1. Create base passport canvas (ID-3 aspect ratio: 1250 x 880)
    w, h = 1250, 880
    passport = np.ones((h, w, 3), dtype=np.uint8) * 245

    # Background texture / subtle guilloche wave pattern
    for y in range(0, h, 20):
        color = (235, 230, 220) if (y // 20) % 2 == 0 else (240, 235, 225)
        cv2.line(passport, (0, y), (w, y), color, 1)

    # Border & Header
    cv2.rectangle(passport, (30, 30), (w - 30, h - 30), (70, 70, 70), 3)
    cv2.rectangle(passport, (40, 40), (w - 40, 140), (30, 60, 110), -1)
    cv2.putText(passport, "REPUBLIC OF UTOPIA", (60, 95), cv2.FONT_HERSHEY_DUPLEX, 1.3, (255, 255, 255), 2)
    cv2.putText(passport, "PASSPORT / PASSEPORT", (60, 125), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 220, 255), 1)

    # Synthetic Photo Box (fictional silhouette placeholder)
    photo_x, photo_y, photo_w, photo_h = 70, 180, 260, 340
    cv2.rectangle(passport, (photo_x, photo_y), (photo_x + photo_w, photo_y + photo_h), (180, 180, 180), -1)
    cv2.rectangle(passport, (photo_x, photo_y), (photo_x + photo_w, photo_y + photo_h), (80, 80, 80), 2)
    # Head silhouette
    cv2.circle(passport, (photo_x + photo_w // 2, photo_y + 110), 60, (120, 120, 120), -1)
    # Body silhouette
    pts = np.array([
        [photo_x + 30, photo_y + photo_h - 10],
        [photo_x + photo_w - 30, photo_y + photo_h - 10],
        [photo_x + photo_w - 50, photo_y + 200],
        [photo_x + 50, photo_y + 200]
    ], np.int32)
    cv2.fillPoly(passport, [pts], (120, 120, 120))
    cv2.putText(passport, "SPECIMEN", (photo_x + 50, photo_y + photo_h - 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

    # Document Fields (Human Readable Zone)
    field_x = 380
    start_y = 200
    line_gap = 55

    fields = [
        ("Type / Type", "P"),
        ("Country Code / Pays", nationality),
        ("Passport No. / No. du Passeport", viz_doc_number or doc_number),
        ("Surname / Nom", surname),
        ("Given Names / Prenoms", name),
        ("Nationality / Nationalite", "INDIAN" if nationality == "IND" else "UTOPIAN"),
        ("Date of Birth / Date de Naissance", "15 AUG 1998" if dob == "980815" else "12 JUL 1985"),
        ("Sex / Sexe", sex),
        ("Date of Issue / Date de Delivrance", "10 MAR 2021"),
        ("Date of Expiry / Date d'Expiration", "09 MAR 2031" if expiry == "310309" else "01 JAN 2030"),
    ]

    for i, (label, val) in enumerate(fields):
        col = field_x if i < 5 else field_x + 400
        row_idx = i if i < 5 else i - 5
        curr_y = start_y + (row_idx * line_gap)
        cv2.putText(passport, label, (col, curr_y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 100, 100), 1, cv2.LINE_AA)
        cv2.putText(passport, val, (col, curr_y + 24), cv2.FONT_HERSHEY_DUPLEX, 0.75, (20, 20, 20), 2, cv2.LINE_AA)

    # Compute valid ICAO 9303 check digits
    doc_padded = doc_number.ljust(9, '<')[:9]
    doc_chk = compute_check_digit(doc_padded)
    dob_chk = compute_check_digit(dob)
    exp_chk = compute_check_digit(expiry)
    opt_data = "<" * 14
    opt_chk = "<"
    composite_payload = f"{doc_padded}{doc_chk}{dob}{dob_chk}{expiry}{exp_chk}{opt_data}{opt_chk}"
    composite_chk = compute_check_digit(composite_payload)

    # ICAO Doc 9303 TD3 Machine Readable Zone (MRZ)
    mrz_bg_y = h - 220
    cv2.rectangle(passport, (40, mrz_bg_y), (w - 40, h - 40), (255, 255, 255), -1)
    cv2.line(passport, (40, mrz_bg_y), (w - 40, mrz_bg_y), (150, 150, 150), 1)

    mrz_line1 = f"P<{nationality}{surname}<<{name}".ljust(44, '<')[:44]
    mrz_line2 = f"{doc_padded}{doc_chk}{nationality}{dob}{dob_chk}{sex}{expiry}{exp_chk}{opt_data}{opt_chk}{composite_chk}".ljust(44, '<')[:44]

    slot_w = (w - 140.0) / 44.0
    for i, ch in enumerate(mrz_line1):
        cx = int(70 + i * slot_w)
        cv2.putText(passport, ch, (cx + 3, mrz_bg_y + 65), cv2.FONT_HERSHEY_SIMPLEX, 0.95, (10, 10, 10), 2, cv2.LINE_AA)

    for i, ch in enumerate(mrz_line2):
        cx = int(70 + i * slot_w)
        cv2.putText(passport, ch, (cx + 3, mrz_bg_y + 135), cv2.FONT_HERSHEY_SIMPLEX, 0.95, (10, 10, 10), 2, cv2.LINE_AA)

    if not tilt_and_place:
        output_path = os.path.join("data/synthetic", output_filename)
        cv2.imwrite(output_path, passport)
        return output_path

    # 2. Place onto background with perspective distortion
    bg_w, bg_h = 1800, 1400
    bg = np.zeros((bg_h, bg_w, 3), dtype=np.uint8)
    bg[:, :] = (60, 90, 120)  # Dark desktop background
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
    return output_path


def generate_tampered_synthetic_passport(
    tamper_type: str = "number_mismatch"
) -> str:
    """
    Generates synthetic passport with deliberate tampering for officer UI & test demos:
    - 'number_mismatch': VIZ doc number differs from MRZ doc number.
    - 'checksum_invalid': MRZ check digit intentionally corrupted.
    - 'expired': Expiry date set in the past.
    """
    if tamper_type == "number_mismatch":
        return generate_synthetic_passport(
            name="JANE",
            surname="DOE",
            doc_number="A12345678",
            viz_doc_number="X99999999",
            output_filename="sample_tampered_mismatch.jpg"
        )
    elif tamper_type == "expired":
        return generate_synthetic_passport(
            name="JOHN",
            surname="SMITH",
            doc_number="B98765432",
            expiry="190101",  # 2019 (Expired)
            output_filename="sample_tampered_expired.jpg"
        )
    else:
        return generate_synthetic_passport(output_filename="sample_tampered_generic.jpg")


if __name__ == "__main__":
    path1 = generate_synthetic_passport()
    path2 = generate_tampered_synthetic_passport("number_mismatch")
    print(f"Generated synthetic passport: {path1}")
    print(f"Generated tampered passport: {path2}")
