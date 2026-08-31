"""
1:1 Face Verification and Embedding Matcher Engine.
Computes multi-scale facial feature vectors and calibrated cosine similarity
between the document photo and the live captured selfie.
"""
import cv2
import numpy as np
from typing import Tuple, Dict, Optional, Any
from pydantic import BaseModel, Field


class FaceMatchResult(BaseModel):
    """Result of 1:1 face similarity verification."""
    match_status: str = Field(..., description="MATCH, MISMATCH, or UNCERTAIN")
    similarity_score: float = Field(..., description="Calibrated similarity 0.0 to 1.0")
    cosine_distance: float
    is_match: bool
    confidence: float
    details: Optional[str] = None


def extract_facial_embedding_vector(face_crop: np.ndarray) -> np.ndarray:
    """
    Extracts a zero-centered, multi-scale facial representation embedding vector.
    Combines spatial frequency grids, normalized gradient orientations (HOG),
    and local texture descriptors.
    """
    if len(face_crop.shape) == 3:
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = face_crop

    gray = cv2.resize(gray, (128, 128), interpolation=cv2.INTER_AREA)

    # 1. Illumination normalization via CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    norm_face = clahe.apply(gray).astype(np.float32)

    # 2. Local block intensity variance and gradients (8x8 cells)
    grid_features = []
    cell_h, cell_w = 16, 16
    for y in range(0, 128, cell_h):
        for x in range(0, 128, cell_w):
            cell = norm_face[y:y + cell_h, x:x + cell_w]
            grid_features.append(float(np.mean(cell) - 128.0))
            grid_features.append(float(np.std(cell)))

    # 3. Sobel gradient orientations & magnitudes
    gx = cv2.Sobel(norm_face, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(norm_face, cv2.CV_32F, 0, 1, ksize=3)
    mag, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)

    quad_h, quad_w = 32, 32
    hog_features = []
    for qy in range(0, 128, quad_h):
        for qx in range(0, 128, quad_w):
            q_mag = mag[qy:qy + quad_h, qx:qx + quad_w]
            q_ang = ang[qy:qy + quad_h, qx:qx + quad_w]
            
            hist, _ = np.histogram(q_ang, bins=8, range=(0, 360), weights=q_mag)
            norm_factor = np.linalg.norm(hist) + 1e-6
            hog_features.extend((hist / norm_factor - 0.125).tolist())

    # 4. Low-frequency 2D DCT coefficients (ignoring DC at [0,0])
    dct = cv2.dct(norm_face / 255.0)
    dct_features = dct[0:8, 0:8].flatten()[1:].tolist()

    # 5. Concatenate and zero-center feature embedding
    combined = np.array(grid_features + hog_features + dct_features, dtype=np.float32)
    centered = combined - np.mean(combined)

    norm = np.linalg.norm(centered)
    if norm > 1e-6:
        embedding = centered / norm
    else:
        embedding = centered

    return embedding


def compute_cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """Computes cosine similarity between two zero-centered unit vectors (-1.0 to 1.0)."""
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    if norm1 < 1e-6 or norm2 < 1e-6:
        return 0.0
    dot_product = np.dot(vec1, vec2)
    similarity = float(dot_product / (norm1 * norm2))
    return max(-1.0, min(1.0, similarity))


def verify_face_match(
    doc_face_crop: np.ndarray,
    live_face_crop: np.ndarray,
    match_threshold: float = 0.70,
    uncertain_threshold: float = 0.50,
    baseline_similarity: float = 0.35
) -> FaceMatchResult:
    """
    Verifies if document face and live selfie belong to the same person.
    """
    if doc_face_crop is None or live_face_crop is None:
        return FaceMatchResult(
            match_status="MISMATCH",
            similarity_score=0.0,
            cosine_distance=1.0,
            is_match=False,
            confidence=0.0,
            details="Missing face crop in document or live selfie."
        )

    vec_doc = extract_facial_embedding_vector(doc_face_crop)
    vec_live = extract_facial_embedding_vector(live_face_crop)

    raw_sim = compute_cosine_similarity(vec_doc, vec_live)
    
    # Calibrate relative to baseline inter-class similarity
    calibrated_sim = float(np.clip((raw_sim - baseline_similarity) / (1.0 - baseline_similarity), 0.0, 1.0))
    calibrated_sim = round(calibrated_sim, 3)
    cosine_dist = round(1.0 - raw_sim, 3)

    if calibrated_sim >= match_threshold:
        status = "MATCH"
        is_match = True
        conf = round(min(1.0, 0.70 + (calibrated_sim - match_threshold) * 1.5), 2)
        details = f"Face similarity high ({calibrated_sim:.1%}). Identity match confirmed."
    elif calibrated_sim >= uncertain_threshold:
        status = "UNCERTAIN"
        is_match = False
        conf = 0.55
        details = f"Face similarity borderline ({calibrated_sim:.1%}). Manual review recommended."
    else:
        status = "MISMATCH"
        is_match = False
        conf = round(min(1.0, 0.75 + (uncertain_threshold - calibrated_sim) * 1.5), 2)
        details = f"Face similarity low ({calibrated_sim:.1%}). Document photo does not match live face."

    return FaceMatchResult(
        match_status=status,
        similarity_score=calibrated_sim,
        cosine_distance=cosine_dist,
        is_match=is_match,
        confidence=conf,
        details=details
    )
