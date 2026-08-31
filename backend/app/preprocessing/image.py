"""
Document Image Preprocessing Pipeline for VeriGuard AI.

Implements the end-to-end preprocessing flow:
Input Image -> Read Image & EXIF Fix -> Quality Check -> Boundary Detection ->
Crop & Perspective Transform -> Resolution & Contrast Normalization -> Output Image
"""
import os
import sys
import time
from dataclasses import dataclass, field
from typing import Optional, Union, Dict, Any, List
import cv2
import numpy as np
from PIL import Image, ImageOps

from backend.app.preprocessing.quality import check_image_quality, QualityReport
from backend.app.preprocessing.detector import detect_document_corners
from backend.app.geometry.transform import four_point_transform


# Standard ISO/IEC 7810 ID-3 Passport Aspect Ratio: 125mm / 88mm ~= 1.4205
STANDARD_PASSPORT_ASPECT_RATIO = 125.0 / 88.0
STANDARD_TARGET_WIDTH = 1000
STANDARD_TARGET_HEIGHT = int(STANDARD_TARGET_WIDTH / STANDARD_PASSPORT_ASPECT_RATIO)  # ~704px


@dataclass
class PreprocessingResult:
    """Encapsulates the complete result of document preprocessing."""
    success: bool
    processed_image: Optional[np.ndarray]
    quality_report: QualityReport
    corners_detected: Optional[List[List[float]]]
    detection_confidence: float
    original_size: Dict[str, int]
    processed_size: Dict[str, int]
    processing_time_ms: float
    output_path: Optional[str] = None
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "quality": self.quality_report.to_dict(),
            "corners_detected": self.corners_detected,
            "detection_confidence": round(self.detection_confidence, 2),
            "original_size": self.original_size,
            "processed_size": self.processed_size,
            "processing_time_ms": round(self.processing_time_ms, 2),
            "output_path": self.output_path,
            "error_message": self.error_message
        }


def read_pdf_first_page(pdf_source: Union[str, bytes]) -> np.ndarray:
    """Renders the first page of a PDF document at 300 DPI as a BGR image."""
    import pypdfium2 as pdfium
    try:
        if isinstance(pdf_source, bytes):
            pdf = pdfium.PdfDocument(pdf_source)
        else:
            pdf = pdfium.PdfDocument(pdf_source)

        if len(pdf) == 0:
            raise ValueError("PDF document has 0 pages.")

        page = pdf[0]
        # Render at 300 DPI (scale = 300 / 72 ~= 4.1667)
        pil_img = page.render(scale=300.0 / 72.0).to_pil()
        rgb_img = np.array(pil_img.convert("RGB"))
        return cv2.cvtColor(rgb_img, cv2.COLOR_RGB2BGR)
    except Exception as e:
        raise ValueError(f"Failed to render PDF page: {str(e)}")


def read_image_with_orientation(input_source: Union[str, bytes, np.ndarray]) -> np.ndarray:
    """
    Reads an image or PDF from a filepath, raw byte stream, or numpy array,
    properly handling EXIF orientation metadata and PDF page rasterization.

    Args:
        input_source: Path to file, image/PDF bytes, or existing numpy BGR array.

    Returns:
        np.ndarray in BGR color format.
    """
    if isinstance(input_source, np.ndarray):
        return input_source.copy()

    if isinstance(input_source, bytes):
        # 1. Check for PDF header (%PDF)
        if input_source.startswith(b"%PDF"):
            return read_pdf_first_page(input_source)

        # 2. Try OpenCV decode
        nparr = np.frombuffer(input_source, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            return img

        # 3. Try PIL decode (WEBP, TIFF, HEIC, etc.)
        try:
            import io
            pil_img = Image.open(io.BytesIO(input_source))
            pil_img = ImageOps.exif_transpose(pil_img)
            rgb_img = np.array(pil_img.convert("RGB"))
            return cv2.cvtColor(rgb_img, cv2.COLOR_RGB2BGR)
        except Exception:
            pass

        # 4. Try PDF parser as last resort for bytes
        try:
            return read_pdf_first_page(input_source)
        except Exception:
            pass

        raise ValueError("Failed to decode image or PDF from bytes.")

    if isinstance(input_source, str):
        if not os.path.exists(input_source):
            raise FileNotFoundError(f"Input file not found: {input_source}")

        # Check for PDF extension
        if input_source.lower().endswith(".pdf"):
            return read_pdf_first_page(input_source)

        # Use PIL to read and automatically transpose based on EXIF orientation
        try:
            pil_img = Image.open(input_source)
            pil_img = ImageOps.exif_transpose(pil_img)
            rgb_img = np.array(pil_img.convert("RGB"))
            return cv2.cvtColor(rgb_img, cv2.COLOR_RGB2BGR)
        except Exception:
            # Fallback to direct OpenCV read
            bgr_img = cv2.imread(input_source)
            if bgr_img is not None:
                return bgr_img

            # Try PDF parser if file has non-.pdf extension but contains PDF data
            try:
                return read_pdf_first_page(input_source)
            except Exception:
                raise ValueError(f"Could not read image or PDF from path: {input_source}")

    raise TypeError(f"Unsupported input source type: {type(input_source)}")


def normalize_illumination(image: np.ndarray) -> np.ndarray:
    """
    Applies mild Contrast Limited Adaptive Histogram Equalization (CLAHE)
    to the Luminance channel to balance shadows and highlights.
    """
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    l_eq = clahe.apply(l)
    lab_eq = cv2.merge((l_eq, a, b))
    return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)


def preprocess_document(
    input_source: Union[str, bytes, np.ndarray],
    output_path: Optional[str] = None,
    target_width: int = STANDARD_TARGET_WIDTH,
    target_height: Optional[int] = STANDARD_TARGET_HEIGHT,
    aspect_ratio: Optional[float] = STANDARD_PASSPORT_ASPECT_RATIO,
    enhance_contrast: bool = False
) -> PreprocessingResult:
    """
    Full document preprocessing pipeline:
    1. Read image (with EXIF correction)
    2. Check image quality (blur, glare, exposure)
    3. Detect document corners & boundaries
    4. Crop & apply perspective warp correction
    5. Standardize dimensions & normalize lighting
    6. Optionally save to output_path

    Args:
        input_source: Path to input image, bytes, or numpy array.
        output_path: Optional path to save the straightened, cropped image.
        target_width: Desired output width in pixels.
        target_height: Desired output height in pixels (if None, calculated from aspect_ratio).
        aspect_ratio: Document aspect ratio (width / height).
        enhance_contrast: Whether to apply CLAHE illumination balancing.

    Returns:
        PreprocessingResult containing processed image array, quality metrics, and metadata.
    """
    start_time = time.perf_counter()

    try:
        # 1. Read image
        img = read_image_with_orientation(input_source)
        orig_h, orig_w = img.shape[:2]

        # 2. Quality Assessment
        quality = check_image_quality(img)

        # 3. Detect Document Boundary Corners
        corners, confidence = detect_document_corners(img)

        # 4. Crop & Perspective Correction
        warped, (out_w, out_h) = four_point_transform(
            img,
            corners,
            target_width=target_width,
            target_height=target_height,
            aspect_ratio=aspect_ratio
        )

        # 5. Normalization
        processed = normalize_illumination(warped) if enhance_contrast else warped

        # 6. Save to disk if output path specified
        if output_path:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            cv2.imwrite(output_path, processed)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return PreprocessingResult(
            success=True,
            processed_image=processed,
            quality_report=quality,
            corners_detected=corners.tolist() if corners is not None else None,
            detection_confidence=confidence,
            original_size={"width": orig_w, "height": orig_h},
            processed_size={"width": out_w, "height": out_h},
            processing_time_ms=elapsed_ms,
            output_path=output_path,
            error_message=None
        )

    except Exception as e:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        empty_quality = QualityReport(
            is_valid=False, blur_score=0.0, is_blurry=True, glare_ratio=0.0,
            has_glare=False, mean_brightness=0.0, is_underexposed=False,
            is_overexposed=False, contrast_score=0.0, is_low_contrast=False,
            width=0, height=0, warnings=[str(e)]
        )
        return PreprocessingResult(
            success=False,
            processed_image=None,
            quality_report=empty_quality,
            corners_detected=None,
            detection_confidence=0.0,
            original_size={"width": 0, "height": 0},
            processed_size={"width": 0, "height": 0},
            processing_time_ms=elapsed_ms,
            output_path=None,
            error_message=str(e)
        )


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    if len(sys.argv) < 2:
        print("Usage: python -m backend.app.preprocessing.image <input_image_path> [output_image_path]")
        sys.exit(1)

    inp = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "processed.jpg"

    print(f"[VeriGuard Preprocessing] Processing: {inp} -> {out}")
    result = preprocess_document(inp, output_path=out)

    if result.success:
        print(f"[OK] Success! Processed image saved to: {out}")
        print(f"    - Original Size: {result.original_size['width']}x{result.original_size['height']}")
        print(f"    - Processed Size: {result.processed_size['width']}x{result.processed_size['height']}")
        print(f"    - Detection Confidence: {result.detection_confidence * 100:.1f}%")
        print(f"    - Sharpness/Blur Score: {result.quality_report.blur_score:.1f} (Blurry: {result.quality_report.is_blurry})")
        print(f"    - Processing Time: {result.processing_time_ms:.1f} ms")
        if result.quality_report.warnings:
            print(f"    - Warnings: {result.quality_report.warnings}")
    else:
        print(f"[ERROR] Preprocessing failed: {result.error_message}")
        sys.exit(1)

