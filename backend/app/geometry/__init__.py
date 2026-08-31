"""
Geometry and Layout Analysis Module for VeriGuard AI.
Provides perspective correction, homography transformations,
spatial margin verification, photo positioning, and text alignment checks.
"""
from backend.app.geometry.transform import (
    order_points,
    four_point_transform
)
from backend.app.geometry.template import (
    TD3PassportTemplate,
    DEFAULT_TD3_TEMPLATE,
    RegionSpec
)
from backend.app.geometry.analysis import (
    BoundingBox,
    GeometricMeasurement,
    PassportGeometryReport,
    OverlayBox,
    detect_photo_bounding_box,
    detect_mrz_bounding_box,
    extract_text_line_bounding_boxes,
    evaluate_passport_geometry
)

__all__ = [
    "order_points",
    "four_point_transform",
    "TD3PassportTemplate",
    "DEFAULT_TD3_TEMPLATE",
    "RegionSpec",
    "BoundingBox",
    "GeometricMeasurement",
    "PassportGeometryReport",
    "OverlayBox",
    "detect_photo_bounding_box",
    "detect_mrz_bounding_box",
    "extract_text_line_bounding_boxes",
    "evaluate_passport_geometry"
]
