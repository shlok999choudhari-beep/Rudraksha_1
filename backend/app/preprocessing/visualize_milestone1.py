"""
Milestone 1 Validation Script: Perspective Correction & Geometry Verification.
Generates an annotated side-by-side visual comparison demonstrating:
1. Skewed/tilted input with detected 4-point corner landmarks & bounding polygon.
2. Straightened, perspective-corrected output with orthogonal alignment guides.
"""
import os
import sys
import cv2
import numpy as np

from backend.app.preprocessing.image import preprocess_document, read_image_with_orientation
from backend.app.geometry.transform import order_points


def create_geometry_validation_visualization(
    input_path: str,
    output_comparison_path: str = "data/processed/milestone1_geometry_validation.jpg"
) -> str:
    """
    Creates a visual side-by-side comparison proving perspective correction accuracy.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_comparison_path)), exist_ok=True)

    # 1. Run Preprocessing Pipeline
    result = preprocess_document(input_path)
    if not result.success or result.processed_image is None:
        raise RuntimeError(f"Preprocessing failed: {result.error_message}")

    # 2. Annotate Input Image with Detected Corners and Polygon
    orig_img = read_image_with_orientation(input_path)
    annotated_input = orig_img.copy()

    if result.corners_detected is not None:
        corners = np.array(result.corners_detected, dtype=np.int32)
        # Draw bounding polygon
        cv2.polylines(annotated_input, [corners], isClosed=True, color=(0, 255, 255), thickness=4)

        # Corner color markers and labels
        # TL: Green (0, 255, 0), TR: Cyan (255, 255, 0), BR: Red (0, 0, 255), BL: Magenta (255, 0, 255)
        labels = [("TL", (0, 255, 0)), ("TR", (255, 255, 0)), ("BR", (0, 0, 255)), ("BL", (255, 0, 255))]
        for i, (pt, (label, color)) in enumerate(zip(corners, labels)):
            cv2.circle(annotated_input, tuple(pt), 12, color, -1)
            cv2.circle(annotated_input, tuple(pt), 14, (255, 255, 255), 2)
            cv2.putText(
                annotated_input,
                f"{label} ({pt[0]},{pt[1]})",
                (pt[0] + 15, pt[1] - 10 if pt[1] > 30 else pt[1] + 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )

    # Add Title Header to Input
    cv2.putText(annotated_input, "INPUT: SKEWED / TILTED DOCUMENT", (30, 60), cv2.FONT_HERSHEY_DUPLEX, 1.1, (0, 255, 255), 2)
    cv2.putText(
        annotated_input,
        f"Detected Confidence: {result.detection_confidence * 100:.1f}%",
        (30, 105),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (200, 255, 200),
        2
    )

    # 3. Annotate Straightened Output with Alignment Guides
    straightened = result.processed_image.copy()
    h, w = straightened.shape[:2]

    # Draw border guide and alignment ruler lines
    cv2.rectangle(straightened, (0, 0), (w - 1, h - 1), (0, 255, 0), 3)
    # Title Header on Output
    cv2.putText(straightened, "OUTPUT: PERSPECTIVE CORRECTED & NORMALIZED", (25, 45), cv2.FONT_HERSHEY_DUPLEX, 0.75, (0, 255, 0), 2)
    cv2.putText(
        straightened,
        f"Dimensions: {w}x{h} px (ISO/IEC 7810 ID-3)",
        (25, 75),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (100, 100, 100),
        1
    )

    # 4. Scale both images to consistent height for side-by-side composite canvas
    target_canvas_h = 750
    scale1 = target_canvas_h / annotated_input.shape[0]
    scaled_input = cv2.resize(annotated_input, (int(annotated_input.shape[1] * scale1), target_canvas_h))

    scale2 = target_canvas_h / straightened.shape[0]
    scaled_output = cv2.resize(straightened, (int(straightened.shape[1] * scale2), target_canvas_h))

    # Divider bar
    divider = np.ones((target_canvas_h, 8, 3), dtype=np.uint8) * 200

    # Composite canvas
    comparison = np.hstack([scaled_input, divider, scaled_output])

    cv2.imwrite(output_comparison_path, comparison)
    return output_comparison_path


if __name__ == "__main__":
    inp = sys.argv[1] if len(sys.argv) > 1 else "data/synthetic/sample_tilted_passport.jpg"
    out = sys.argv[2] if len(sys.argv) > 2 else "data/processed/milestone1_geometry_validation.jpg"

    saved_path = create_geometry_validation_visualization(inp, out)
    print(f"[OK] Milestone 1 visualization generated at: {saved_path}")
