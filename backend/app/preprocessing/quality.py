"""Image quality assessment module for document screening."""
from dataclasses import dataclass, field
from typing import List, Dict, Any
import cv2
import numpy as np


@dataclass
class QualityReport:
    """Detailed quality assessment report for document images."""
    is_valid: bool
    blur_score: float
    is_blurry: bool
    glare_ratio: float
    has_glare: bool
    mean_brightness: float
    is_underexposed: bool
    is_overexposed: bool
    contrast_score: float
    is_low_contrast: bool
    width: int
    height: int
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "blur_score": round(self.blur_score, 2),
            "is_blurry": self.is_blurry,
            "glare_ratio": round(self.glare_ratio, 4),
            "has_glare": self.has_glare,
            "mean_brightness": round(self.mean_brightness, 2),
            "is_underexposed": self.is_underexposed,
            "is_overexposed": self.is_overexposed,
            "contrast_score": round(self.contrast_score, 2),
            "is_low_contrast": self.is_low_contrast,
            "resolution": f"{self.width}x{self.height}",
            "warnings": self.warnings
        }


def check_image_quality(
    image: np.ndarray,
    blur_threshold: float = 80.0,
    glare_threshold: float = 0.05,
    min_brightness: float = 40.0,
    max_brightness: float = 230.0,
    min_contrast: float = 25.0,
    min_width: int = 400,
    min_height: int = 300
) -> QualityReport:
    """
    Evaluates blur, glare, lighting, contrast, and resolution of an image.

    Args:
        image: Source BGR image numpy array.
        blur_threshold: Variance of Laplacian below which image is blurry.
        glare_threshold: Fraction of pixels > 250 indicating severe specular glare.
        min_brightness: Minimum average grayscale luminance.
        max_brightness: Maximum average grayscale luminance.
        min_contrast: Minimum standard deviation of grayscale luminance.
        min_width: Minimum width in pixels.
        min_height: Minimum height in pixels.

    Returns:
        QualityReport object.
    """
    if image is None or image.size == 0:
        return QualityReport(
            is_valid=False,
            blur_score=0.0,
            is_blurry=True,
            glare_ratio=1.0,
            has_glare=False,
            mean_brightness=0.0,
            is_underexposed=True,
            is_overexposed=False,
            contrast_score=0.0,
            is_low_contrast=True,
            width=0,
            height=0,
            warnings=["Image is empty or unreadable."]
        )

    h, w = image.shape[:2]
    warnings: List[str] = []

    # Check resolution
    if w < min_width or h < min_height:
        warnings.append(f"Low resolution ({w}x{h}). Minimum required is {min_width}x{min_height}.")

    # Convert to grayscale for metrics
    if len(image.shape) == 3 and image.shape[2] == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # 1. Blur Detection (Laplacian Variance)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    blur_score = float(laplacian.var())
    is_blurry = blur_score < blur_threshold
    if is_blurry:
        warnings.append(f"Image appears blurry (sharpness score {blur_score:.1f} < threshold {blur_threshold:.1f}).")

    # 2. Specular Glare Detection (Morphological Blob & Text-Aware Analysis)
    total_pixels = max(gray.size, 1)
    if len(image.shape) == 3 and image.shape[2] == 3:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        sat = hsv[:, :, 1]
    else:
        sat = np.zeros_like(gray)

    # Candidate specular blown-out pixels (pure saturated white hotspot)
    highlight_mask = (gray >= 253) & (sat <= 20)
    highlight_u8 = highlight_mask.astype(np.uint8) * 255

    # Morphological opening to filter isolated noise / anti-aliased character edges
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    cleaned_highlights = cv2.morphologyEx(highlight_u8, cv2.MORPH_OPEN, kernel)

    # Analyze connected components
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(cleaned_highlights)
    true_glare_pixels = 0
    min_glare_area = max(250, int(total_pixels * 0.002))

    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        bx = stats[i, cv2.CC_STAT_LEFT]
        by = stats[i, cv2.CC_STAT_TOP]
        bw = stats[i, cv2.CC_STAT_WIDTH]
        bh = stats[i, cv2.CC_STAT_HEIGHT]

        if area < min_glare_area:
            continue

        # Check if this is the legitimate MRZ optical white band at bottom of document
        is_bottom_band = (by > 0.50 * h) and (bw > 0.40 * w) and (bw / max(bh, 1) > 2.0)
        if is_bottom_band:
            patch_gray = gray[by:by+bh, bx:bx+bw]
            lap_var = cv2.Laplacian(patch_gray, cv2.CV_64F).var()
            if lap_var > 8.0:  # Contains printed text/edges
                continue

        true_glare_pixels += area

    glare_ratio = float(true_glare_pixels / total_pixels)
    has_glare = glare_ratio > glare_threshold
    if has_glare:
        warnings.append(f"Specular reflection/glare detected ({glare_ratio * 100:.1f}% hotspot coverage).")

    # 3. Brightness & Exposure
    mean_brightness = float(np.mean(gray))
    is_underexposed = mean_brightness < min_brightness
    is_overexposed = mean_brightness > max_brightness
    if is_underexposed:
        warnings.append(f"Image is underexposed/too dark (brightness: {mean_brightness:.1f}).")
    if is_overexposed:
        warnings.append(f"Image is overexposed/too bright (brightness: {mean_brightness:.1f}).")

    # 4. Contrast
    contrast_score = float(np.std(gray))
    is_low_contrast = contrast_score < min_contrast
    if is_low_contrast:
        warnings.append(f"Low contrast detected (contrast std: {contrast_score:.1f}).")

    # Overall validity (critical warnings fail the check)
    is_valid = not (is_blurry and blur_score < (blur_threshold / 2)) and not (w < 200 or h < 150)

    return QualityReport(
        is_valid=is_valid,
        blur_score=blur_score,
        is_blurry=is_blurry,
        glare_ratio=glare_ratio,
        has_glare=has_glare,
        mean_brightness=mean_brightness,
        is_underexposed=is_underexposed,
        is_overexposed=is_overexposed,
        contrast_score=contrast_score,
        is_low_contrast=is_low_contrast,
        width=w,
        height=h,
        warnings=warnings
    )
