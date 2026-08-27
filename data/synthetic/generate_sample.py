"""
Synthetic Document Generator for VeriGuard AI Testing.
Generates realistic, completely synthetic/fictional passport images
with mock MRZ, fictional data, and perspective tilt on a desk background
for pipeline validation without using real identity data.
"""
import os
import cv2
import numpy as np


def generate_synthetic_passport(
    name: str = "SPECIMEN<<JANE",
    surname: str = "DOE",
    nationality: str = "UTO",  # Utopia
    doc_number: str = "A12345678",
    dob: str = "850712",       # 12 Jul 1985
    sex: str = "F",
    expiry: str = "300101",    # 01 Jan 2030
    tilt_and_place: bool = True
) -> str:
    """
    Generates a synthetic passport image and saves it to data/synthetic/sample_tilted_passport.jpg.

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
        ("Passport No. / No. du Passeport", doc_number),
        ("Surname / Nom", surname),
        ("Given Names / Prenoms", "JANE"),
        ("Nationality / Nationalite", "UTOPIAN"),
        ("Date of Birth / Date de Naissance", "12 JUL 1985"),
        ("Sex / Sexe", sex),
        ("Date of Issue / Date de Delivrance", "01 JAN 2020"),
        ("Date of Expiry / Date d'Expiration", "01 JAN 2030"),
    ]

    for i, (label, val) in enumerate(fields):
        col = field_x if i < 5 else field_x + 400
        row_idx = i if i < 5 else i - 5
        curr_y = start_y + (row_idx * line_gap)
        cv2.putText(passport, label, (col, curr_y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 100, 100), 1)
        cv2.putText(passport, val, (col, curr_y + 24), cv2.FONT_HERSHEY_DUPLEX, 0.75, (20, 20, 20), 2)

    # ICAO Doc 9303 TD3 Machine Readable Zone (MRZ - 2 lines of 44 chars)
    mrz_bg_y = h - 220
    cv2.rectangle(passport, (40, mrz_bg_y), (w - 40, h - 40), (255, 255, 255), -1)
    cv2.line(passport, (40, mrz_bg_y), (w - 40, mrz_bg_y), (150, 150, 150), 1)

    mrz_line1 = f"P<{nationality}{surname}<<JANE<<<<<<<<<<<<<<<<<<<<<<<"[:44].ljust(44, '<')
    mrz_line2 = f"{doc_number}8{nationality}{dob}4{sex}{expiry}7<<<<<<<<<<<<<<<2"[:44].ljust(44, '<')

    cv2.putText(passport, mrz_line1, (70, mrz_bg_y + 65), cv2.FONT_HERSHEY_MONO_COMPLEX if hasattr(cv2, 'FONT_HERSHEY_MONO_COMPLEX') else cv2.FONT_HERSHEY_SIMPLEX, 0.95, (10, 10, 10), 2)
    cv2.putText(passport, mrz_line2, (70, mrz_bg_y + 135), cv2.FONT_HERSHEY_MONO_COMPLEX if hasattr(cv2, 'FONT_HERSHEY_MONO_COMPLEX') else cv2.FONT_HERSHEY_SIMPLEX, 0.95, (10, 10, 10), 2)

    if not tilt_and_place:
        output_path = "data/synthetic/sample_passport_flat.jpg"
        cv2.imwrite(output_path, passport)
        return output_path

    # 2. Place onto a realistic background surface with perspective distortion and rotation
    bg_w, bg_h = 1800, 1400
    # Wooden / desk surface texture
    bg = np.zeros((bg_h, bg_w, 3), dtype=np.uint8)
    bg[:, :] = (60, 90, 120)  # Dark desktop background
    # Add subtle noise to surface
    noise = np.random.normal(0, 10, (bg_h, bg_w, 3)).astype(np.int16)
    bg = np.clip(bg.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    # Perspective coordinates on the desk
    src_pts = np.array([
        [0, 0],
        [w, 0],
        [w, h],
        [0, h]
    ], dtype=np.float32)

    dst_pts = np.array([
        [250, 220],    # Top-Left
        [1520, 160],   # Top-Right (slight angle)
        [1600, 1180],  # Bottom-Right
        [180, 1260]    # Bottom-Left
    ], dtype=np.float32)

    matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)
    warped_doc = cv2.warpPerspective(passport, matrix, (bg_w, bg_h))

    # Mask for blending onto background
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.rectangle(mask, (0, 0), (w, h), 255, -1)
    warped_mask = cv2.warpPerspective(mask, matrix, (bg_w, bg_h))

    # Composite onto background
    mask_3d = cv2.cvtColor(warped_mask, cv2.COLOR_GRAY2BGR) / 255.0
    composite = (warped_doc * mask_3d + bg * (1.0 - mask_3d)).astype(np.uint8)

    output_path = "data/synthetic/sample_tilted_passport.jpg"
    cv2.imwrite(output_path, composite)
    return output_path


if __name__ == "__main__":
    path = generate_synthetic_passport()
    print(f"Generated synthetic test document at: {path}")
