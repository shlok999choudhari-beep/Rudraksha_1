"""
Copy-Move and Clone Detection Forensic Engine.
Identifies duplicated regions (cloned stamps, copied signatures, forged digits,
and duplicated texture patches) using keypoint clustering and displacement vector analysis.
Excludes natural text repeating sequences (e.g. MRZ filler '<') and periodic 1D patterns.
"""
import math
import base64
import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional, Any
from pydantic import BaseModel, Field


class ClonedRegionPair(BaseModel):
    """Pair of matched cloned regions (Source and Cloned Target)."""
    source_box: Dict[str, int]
    target_box: Dict[str, int]
    matched_keypoints: int
    displacement_vector: Tuple[float, float]
    confidence: float


class CopyMoveResult(BaseModel):
    """Structured result of Copy-Move Forensic Analysis."""
    is_clone_detected: bool
    clone_anomaly_score: float = Field(..., description="0.0 to 1.0 likelihood of copy-move forgery")
    cloned_pairs: List[ClonedRegionPair] = []
    suspicious_regions: List[Dict[str, Any]] = []
    annotated_image_base64: Optional[str] = None


def detect_copy_move_clones(
    image: np.ndarray,
    min_match_count: int = 15,
    min_spatial_distance: float = 45.0,
    min_cluster_area: int = 500
) -> Tuple[List[ClonedRegionPair], np.ndarray]:
    """
    Detects duplicated / cloned visual regions via ORB feature matching and displacement clustering.
    Excludes the MRZ zone (which inherently contains repeating '<' characters)
    and requires 2D spatial feature dispersion.
    """
    if image is None or image.size == 0:
        return [], image

    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    annotated = image.copy() if len(image.shape) == 3 else cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

    # 1. Create mask to exclude MRZ region (lower 25%) to avoid repeating '<' character false positives
    mask = np.ones((h, w), dtype=np.uint8) * 255
    mrz_top = int(h * 0.72)
    mask[mrz_top:h, :] = 0

    # 2. Extract ORB keypoints outside MRZ
    orb = cv2.ORB_create(nfeatures=1800, scaleFactor=1.2, nlevels=8)
    keypoints, descriptors = orb.detectAndCompute(gray, mask=mask)

    if descriptors is None or len(keypoints) < 15:
        return [], annotated

    # 3. Match descriptors against themselves using BFMatcher with k-NN (k=3)
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    matches = bf.knnMatch(descriptors, descriptors, k=3)

    # 4. Filter matches: ignore self-match (idx 0), apply ratio test on second match
    good_pairs = []
    for m_list in matches:
        if len(m_list) >= 3:
            m1 = m_list[1]
            m2 = m_list[2]
            
            # Ratio test
            if m1.distance < 0.72 * m2.distance:
                pt1 = keypoints[m1.queryIdx].pt
                pt2 = keypoints[m1.trainIdx].pt

                dist = math.hypot(pt2[0] - pt1[0], pt2[1] - pt1[1])
                if dist >= min_spatial_distance:
                    dx = pt2[0] - pt1[0]
                    dy = pt2[1] - pt1[1]
                    good_pairs.append((pt1, pt2, (dx, dy)))

    if len(good_pairs) < min_match_count:
        return [], annotated

    # 5. Group matches by displacement vector (dx, dy)
    vector_clusters: Dict[Tuple[int, int], List[Tuple[Tuple[float, float], Tuple[float, float]]]] = {}
    bin_size = 40

    for pt1, pt2, (dx, dy) in good_pairs:
        if dx < 0 or (dx == 0 and dy < 0):
            pt1, pt2 = pt2, pt1
            dx, dy = -dx, -dy

        bin_key = (int(round(dx / bin_size)), int(round(dy / bin_size)))
        if bin_key not in vector_clusters:
            vector_clusters[bin_key] = []
        vector_clusters[bin_key].append((pt1, pt2))

    cloned_pairs: List[ClonedRegionPair] = []

    # 6. Evaluate clusters with 2D dispersion checks
    for (bin_dx, bin_dy), pairs in vector_clusters.items():
        if len(pairs) >= min_match_count:
            pts_src = np.array([p[0] for p in pairs])
            pts_dst = np.array([p[1] for p in pairs])

            # Ensure 2D spatial variance (not just a 1D repeating line of letters)
            std_src_x = float(np.std(pts_src[:, 0]))
            std_src_y = float(np.std(pts_src[:, 1]))

            if std_src_x >= 6.0 and std_src_y >= 6.0:
                sx, sy, sw, sh = cv2.boundingRect(pts_src.astype(np.int32))
                tx, ty, tw, th = cv2.boundingRect(pts_dst.astype(np.int32))

                src_area = sw * sh
                dst_area = tw * th

                if src_area >= min_cluster_area and dst_area >= min_cluster_area:
                    pad = 12
                    s_box = {
                        "x": max(0, sx - pad),
                        "y": max(0, sy - pad),
                        "w": min(w - sx, sw + 2 * pad),
                        "h": min(h - sy, sh + 2 * pad)
                    }
                    t_box = {
                        "x": max(0, tx - pad),
                        "y": max(0, ty - pad),
                        "w": min(w - tx, tw + 2 * pad),
                        "h": min(h - ty, th + 2 * pad)
                    }

                    confidence = min(1.0, 0.55 + (len(pairs) * 0.05))
                    
                    cloned_pairs.append(ClonedRegionPair(
                        source_box=s_box,
                        target_box=t_box,
                        matched_keypoints=len(pairs),
                        displacement_vector=(float(bin_dx * bin_size), float(bin_dy * bin_size)),
                        confidence=round(confidence, 2)
                    ))

                    cv2.rectangle(annotated, (s_box["x"], s_box["y"]), (s_box["x"] + s_box["w"], s_box["y"] + s_box["h"]), (0, 165, 255), 2)
                    cv2.rectangle(annotated, (t_box["x"], t_box["y"]), (t_box["x"] + t_box["w"], t_box["y"] + t_box["h"]), (0, 0, 255), 2)
                    for p1, p2 in pairs:
                        cv2.line(annotated, (int(p1[0]), int(p1[1])), (int(p2[0]), int(p2[1])), (0, 255, 255), 1)

    return cloned_pairs, annotated


def analyze_copy_move(image: np.ndarray) -> CopyMoveResult:
    """
    High-level Copy-Move Forensic Analysis.
    """
    cloned_pairs, annotated_img = detect_copy_move_clones(image)

    suspicious_regions = []
    for pair in cloned_pairs:
        suspicious_regions.append({
            "x": pair.target_box["x"],
            "y": pair.target_box["y"],
            "w": pair.target_box["w"],
            "h": pair.target_box["h"],
            "matched_points": pair.matched_keypoints,
            "tamper_type": "COPY_MOVE_CLONE",
            "confidence": pair.confidence
        })

    is_clone_detected = len(cloned_pairs) > 0
    clone_score = 0.0
    if cloned_pairs:
        clone_score = max(p.confidence for p in cloned_pairs)

    _, buffer = cv2.imencode(".jpg", annotated_img)
    b64_annotated = base64.b64encode(buffer).decode("utf-8")

    return CopyMoveResult(
        is_clone_detected=is_clone_detected,
        clone_anomaly_score=round(clone_score, 2),
        cloned_pairs=cloned_pairs,
        suspicious_regions=suspicious_regions,
        annotated_image_base64=f"data:image/jpeg;base64,{b64_annotated}"
    )
