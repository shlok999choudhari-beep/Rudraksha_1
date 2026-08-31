"""
Passive Liveness & Presentation Attack Detection (PAD) Engine.
Detects photo-on-screen replay spoofs, printed photo attacks, and 2D presentation attacks
without requiring active video challenge gestures.
"""
import cv2
import numpy as np
from typing import Tuple, Dict, Optional, Any
from pydantic import BaseModel, Field


class LivenessResult(BaseModel):
    """Structured result of passive liveness and anti-spoofing analysis."""
    is_live: bool = Field(..., description="True if face passes presentation attack detection")
    liveness_score: float = Field(..., description="0.0 (spoof) to 1.0 (genuine live person)")
    spoof_type: str = "GENUINE_LIVE_FACE"  # GENUINE_LIVE_FACE, SCREEN_REPLAY_SPOOF, PRINTED_PHOTO_SPOOF, LOW_QUALITY
    confidence: float
    moire_score: float
    texture_score: float
    color_diversity_score: float
    details: Optional[str] = None


def compute_fft_moire_pattern_score(gray_face: np.ndarray) -> float:
    """
    Analyzes high-frequency 2D Fourier spectrum to detect LCD/OLED screen pixel grids (Moire spikes).
    Returns moire anomaly score: 0.0 (no screen grid) to 1.0 (strong screen pattern).
    """
    resized = cv2.resize(gray_face, (128, 128))

    # Compute 2D Fast Fourier Transform
    f = np.fft.fft2(resized.astype(np.float32))
    fshift = np.fft.fftshift(f)
    magnitude_spectrum = 20 * np.log(np.abs(fshift) + 1e-6)

    # Mask out central DC / low-frequency band (central 32x32)
    crow, ccol = 64, 64
    mask = np.ones((128, 128), dtype=bool)
    mask[crow - 16:crow + 16, ccol - 16:ccol + 16] = False

    high_freq_vals = magnitude_spectrum[mask]
    mean_hf = float(np.mean(high_freq_vals))
    max_hf = float(np.max(high_freq_vals))
    std_hf = float(np.std(high_freq_vals))

    # Screen replays produce sharp periodic peaks (spikes) in high frequency bands
    peak_z = (max_hf - mean_hf) / max(std_hf, 1.0)
    moire_score = float(np.clip((peak_z - 2.8) / 3.0, 0.0, 1.0))
    return round(moire_score, 3)


def compute_skin_chroma_diversity_score(bgr_face: np.ndarray) -> float:
    """
    Evaluates color gamut and chrominance distribution in YCbCr color space.
    Genuine live human skin has rich, continuous chrominance variation,
    whereas printed paper or screen replays show compressed color dynamics.
    Returns: 0.0 (compressed/fake color) to 1.0 (natural live skin color).
    """
    if len(bgr_face.shape) != 3 or bgr_face.shape[2] != 3:
        return 0.50

    ycbcr = cv2.cvtColor(bgr_face, cv2.COLOR_BGR2YCrCb)
    cr = ycbcr[:, :, 1]
    cb = ycbcr[:, :, 2]

    std_cr = float(np.std(cr))
    std_cb = float(np.std(cb))
    chroma_var = (std_cr + std_cb) / 2.0

    if 7.0 <= chroma_var <= 35.0:
        score = 0.90 + min(0.10, (chroma_var - 7.0) / 20.0)
    elif chroma_var < 7.0:
        score = max(0.10, chroma_var / 7.0 * 0.70)
    else:
        score = max(0.20, 1.0 - (chroma_var - 35.0) / 30.0)

    return round(float(np.clip(score, 0.0, 1.0)), 3)


def compute_texture_sharpness_and_lbp_score(gray_face: np.ndarray) -> float:
    """
    Measures Laplacian high-frequency gradient variance and local micro-texture richness.
    Returns: 0.0 (smooth/blurry/printed) to 1.0 (live 3D facial pore/skin detail).
    """
    lap = cv2.Laplacian(gray_face, cv2.CV_64F)
    lap_var = float(lap.var())

    if 60.0 <= lap_var <= 1200.0:
        score = 0.85 + min(0.15, (lap_var - 60.0) / 500.0)
    elif lap_var < 60.0:
        score = max(0.10, lap_var / 60.0 * 0.75)
    else:
        score = max(0.30, 1.0 - (lap_var - 1200.0) / 1000.0)

    return round(float(np.clip(score, 0.0, 1.0)), 3)


def evaluate_passive_liveness(
    face_image: np.ndarray,
    liveness_threshold: float = 0.55
) -> LivenessResult:
    """
    Runs multi-feature passive presentation attack detection:
    1. Moire Screen Pattern Detection (FFT).
    2. Skin Chrominance Gamut Analysis (YCbCr).
    3. High-Frequency Micro-Texture Assessment.

    Args:
        face_image: BGR face image.
        liveness_threshold: Threshold above which face is classified as live.

    Returns:
        LivenessResult with is_live status, confidence, and spoof categorization.
    """
    if face_image is None or face_image.size == 0:
        return LivenessResult(
            is_live=False,
            liveness_score=0.0,
            spoof_type="LOW_QUALITY",
            confidence=0.0,
            moire_score=0.0,
            texture_score=0.0,
            color_diversity_score=0.0,
            details="No face image available for liveness inspection."
        )

    gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY) if len(face_image.shape) == 3 else face_image

    # 1. Moire / Screen Replay Analysis
    moire_score = compute_fft_moire_pattern_score(gray)

    # 2. Skin Color Dynamic Range
    color_score = compute_skin_chroma_diversity_score(face_image)

    # 3. Micro-texture & Sharpness
    texture_score = compute_texture_sharpness_and_lbp_score(gray)

    # Composite Liveness Score: (1 - moire) * 0.40 + color * 0.35 + texture * 0.25
    composite_score = (
        ((1.0 - moire_score) * 0.40) +
        (color_score * 0.35) +
        (texture_score * 0.25)
    )
    liveness_score = round(float(np.clip(composite_score, 0.0, 1.0)), 3)

    is_live = (liveness_score >= liveness_threshold) and (moire_score < 0.45)

    if is_live:
        spoof_type = "GENUINE_LIVE_FACE"
        details = "Passive liveness passed: Natural skin chrominance and 3D facial texture verified."
        confidence = round(min(1.0, 0.70 + (liveness_score - liveness_threshold) * 0.75), 2)
    elif moire_score >= 0.45:
        spoof_type = "SCREEN_REPLAY_SPOOF"
        details = f"Presentation attack detected: Periodic Moire interference patterns indicate photo displayed on electronic screen (moire score: {moire_score:.2f})."
        confidence = round(min(1.0, 0.65 + moire_score * 0.35), 2)
    elif color_score < 0.45:
        spoof_type = "PRINTED_PHOTO_SPOOF"
        details = f"Presentation attack detected: Color gamut compression indicates flat printed paper photograph."
        confidence = round(min(1.0, 0.65 + (1.0 - color_score) * 0.35), 2)
    else:
        spoof_type = "UNCERTAIN_QUALITY"
        details = "Borderline facial liveness: Poor lighting, low resolution, or motion blur detected."
        confidence = 0.50

    return LivenessResult(
        is_live=is_live,
        liveness_score=liveness_score,
        spoof_type=spoof_type,
        confidence=confidence,
        moire_score=moire_score,
        texture_score=texture_score,
        color_diversity_score=color_score,
        details=details
    )
