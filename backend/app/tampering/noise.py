"""
Noise Inconsistency & Sensor Variance Forensic Engine.
Analyzes local high-frequency sensor noise distributions across document regions
to detect spliced photographs, pasted text stamps, and smoothed forgery patches.
"""
import base64
import cv2
import numpy as np
from typing import Tuple, List, Dict, Optional, Any
from pydantic import BaseModel, Field


class NoiseAnalysisResult(BaseModel):
    """Structured result of Noise Variance and Inconsistency Analysis."""
    noise_anomaly_score: float = Field(..., description="0.0 (uniform sensor noise) to 1.0 (spliced patches)")
    has_noise_anomaly: bool
    global_noise_variance: float
    noise_variance_std: float
    suspicious_regions: List[Dict[str, Any]] = []
    noise_heatmap_base64: Optional[str] = None


def extract_noise_residual(gray_img: np.ndarray, filter_size: int = 3) -> np.ndarray:
    """
    Extracts high-frequency noise residual by subtracting median-filtered baseline.
    R(x, y) = I(x, y) - Median(I(x, y))
    """
    filtered = cv2.medianBlur(gray_img, filter_size)
    residual = gray_img.astype(np.float32) - filtered.astype(np.float32)
    return residual


def compute_local_noise_variance_map(
    residual: np.ndarray,
    block_size: int = 16,
    stride: int = 8
) -> Tuple[np.ndarray, float, float]:
    """
    Calculates spatial noise variance in sliding blocks across the image.

    Returns:
        (variance_map, global_mean_variance, variance_std)
    """
    h, w = residual.shape[:2]
    var_map = np.zeros((h, w), dtype=np.float32)
    counts = np.zeros((h, w), dtype=np.float32)

    block_variances = []

    for y in range(0, h - block_size + 1, stride):
        for x in range(0, w - block_size + 1, stride):
            block = residual[y:y + block_size, x:x + block_size]
            b_var = float(np.var(block))
            block_variances.append(b_var)
            var_map[y:y + block_size, x:x + block_size] += b_var
            counts[y:y + block_size, x:x + block_size] += 1.0

    counts[counts == 0] = 1.0
    var_map = var_map / counts

    global_mean_var = float(np.mean(block_variances)) if block_variances else 0.0
    var_std = float(np.std(block_variances)) if block_variances else 0.0

    return var_map, global_mean_var, var_std


def detect_noise_discrepancies(
    var_map: np.ndarray,
    global_mean: float,
    global_std: float,
    threshold_sigma: float = 2.5,
    min_area: int = 200
) -> List[Dict[str, Any]]:
    """
    Flags clusters where local noise variance deviates significantly from the document average.
    """
    h, w = var_map.shape[:2]
    if global_std < 1e-4:
        return []

    # Normalized z-score deviation map
    z_map = np.abs(var_map - global_mean) / (global_std + 1e-6)
    
    # Binary mask of statistical outliers
    binary = (z_map > threshold_sigma).astype(np.uint8) * 255

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (13, 13))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    suspicious = []
    for c in contours:
        area = cv2.contourArea(c)
        if area >= min_area:
            x, y, cw, ch = cv2.boundingRect(c)
            # Filter whole-image border noise
            if cw < (w * 0.90) and ch < (h * 0.90):
                mask = np.zeros((h, w), dtype=np.uint8)
                cv2.drawContours(mask, [c], -1, 255, -1)
                mean_z = float(cv2.mean(z_map, mask=mask)[0])

                suspicious.append({
                    "x": int(x),
                    "y": int(y),
                    "w": int(cw),
                    "h": int(ch),
                    "area": int(area),
                    "anomaly_intensity": round(mean_z, 2),
                    "tamper_type": "NOISE_VARIANCE_INCONSISTENCY"
                })

    suspicious.sort(key=lambda item: item["anomaly_intensity"], reverse=True)
    return suspicious


def analyze_noise_inconsistency(image: np.ndarray) -> NoiseAnalysisResult:
    """
    High-level Noise Variance Forensic Analysis.
    """
    if image is None or image.size == 0:
        raise ValueError("Invalid or empty image provided.")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    
    residual = extract_noise_residual(gray)
    var_map, global_mean, var_std = compute_local_noise_variance_map(residual)
    
    suspicious_boxes = detect_noise_discrepancies(var_map, global_mean, var_std)

    # Generate colored noise heatmap
    norm_var = cv2.normalize(var_map, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    heatmap_colored = cv2.applyColorMap(norm_var, cv2.COLORMAP_INFERNO)

    # Noise anomaly score
    # Ratio of std to mean (coefficient of variation) and outlier count
    cv_ratio = var_std / max(global_mean, 1e-4)
    cv_score = min(1.0, max(0.0, (cv_ratio - 0.45) / 1.5))
    cluster_score = min(1.0, len(suspicious_boxes) * 0.30)

    anomaly_score = round(min(1.0, (cv_score * 0.6) + (cluster_score * 0.4)), 2)
    has_anomaly = anomaly_score >= 0.40 or len(suspicious_boxes) > 0

    _, buffer = cv2.imencode(".jpg", heatmap_colored)
    b64_heatmap = base64.b64encode(buffer).decode("utf-8")

    return NoiseAnalysisResult(
        noise_anomaly_score=anomaly_score,
        has_noise_anomaly=has_anomaly,
        global_noise_variance=round(global_mean, 2),
        noise_variance_std=round(var_std, 2),
        suspicious_regions=suspicious_boxes,
        noise_heatmap_base64=f"data:image/jpeg;base64,{b64_heatmap}"
    )
