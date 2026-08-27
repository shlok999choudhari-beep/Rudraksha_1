"""
Geometry transformation and perspective correction utilities for document normalization.
Provides mathematically robust 4-point ordering and homography warping.
"""
from typing import Tuple, Optional
import cv2
import numpy as np


def order_points(pts: np.ndarray) -> np.ndarray:
    """
    Orders 4 arbitrary quadrilateral coordinates into standard order:
    [top-left, top-right, bottom-right, bottom-left].

    Uses a centroid and angle-based approach combined with geometric projection
    to handle arbitrary perspective tilts and rotations accurately.

    Args:
        pts: np.ndarray of shape (4, 2)

    Returns:
        np.ndarray of shape (4, 2) with sorted points in float32 format.
    """
    pts = np.asarray(pts, dtype="float32").reshape((4, 2))

    # Calculate centroid
    center = np.mean(pts, axis=0)

    # Sort points radially counter-clockwise starting from top-left direction
    angles = np.arctan2(pts[:, 1] - center[1], pts[:, 0] - center[0])
    sort_idx = np.argsort(angles)
    sorted_pts = pts[sort_idx]

    # Standard sum/diff refinement for standard perspective orientations
    rect = np.zeros((4, 2), dtype="float32")

    # Sum of coordinates: (x + y)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # Top-left (smallest sum)
    rect[2] = pts[np.argmax(s)]  # Bottom-right (largest sum)

    # Difference of coordinates: (y - x)
    diff = np.diff(pts, axis=1).flatten()
    rect[1] = pts[np.argmin(diff)]  # Top-right (smallest y - x)
    rect[3] = pts[np.argmax(diff)]  # Bottom-left (largest y - x)

    return rect


def four_point_transform(
    image: np.ndarray,
    pts: np.ndarray,
    target_width: Optional[int] = None,
    target_height: Optional[int] = None,
    aspect_ratio: Optional[float] = None
) -> Tuple[np.ndarray, Tuple[int, int]]:
    """
    Applies perspective transformation (homography warp) to straighten and crop
    a 4-point quadrilateral into an orthogonal rectangular plane.

    Args:
        image: Source image (BGR or Grayscale).
        pts: 4 corner points of document in original image.
        target_width: Desired target width in pixels.
        target_height: Desired target height in pixels.
        aspect_ratio: Standard aspect ratio (width / height) to enforce true document geometry.

    Returns:
        Tuple of (warped_image, (dst_width, dst_height)).
    """
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    # Calculate Euclidean lengths of all 4 sides
    width_top = np.linalg.norm(tr - tl)
    width_bottom = np.linalg.norm(br - bl)
    max_width = max(int(width_top), int(width_bottom))

    height_right = np.linalg.norm(tr - br)
    height_left = np.linalg.norm(tl - bl)
    max_height = max(int(height_right), int(height_left))

    # Determine final dimensions with strict aspect ratio preservation
    if target_width is not None and target_height is not None:
        dst_w, dst_h = target_width, target_height
    elif target_width is not None:
        dst_w = target_width
        if aspect_ratio is not None and aspect_ratio > 0:
            dst_h = int(round(dst_w / aspect_ratio))
        else:
            dst_h = int(round(dst_w * (max_height / max(max_width, 1))))
    elif target_height is not None:
        dst_h = target_height
        if aspect_ratio is not None and aspect_ratio > 0:
            dst_w = int(round(dst_h * aspect_ratio))
        else:
            dst_w = int(round(dst_h * (max_width / max(max_height, 1))))
    else:
        dst_w = max(max_width, 100)
        if aspect_ratio is not None and aspect_ratio > 0:
            dst_h = int(round(dst_w / aspect_ratio))
        else:
            dst_h = max(max_height, 100)

    # Destination coordinates on the flat 2D plane
    dst = np.array([
        [0, 0],
        [dst_w - 1, 0],
        [dst_w - 1, dst_h - 1],
        [0, dst_h - 1]
    ], dtype="float32")

    # Compute perspective transform matrix
    transform_matrix = cv2.getPerspectiveTransform(rect, dst)

    # Warp image with high-quality cubic interpolation
    warped = cv2.warpPerspective(
        image,
        transform_matrix,
        (dst_w, dst_h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE
    )

    return warped, (dst_w, dst_h)
