"""
ICAO Doc 9303 TD3 Passport Geometric Reference Template.
Defines standard normalized proportions, tolerances, and expected bounding regions
on a normalized 1250 x 880 canvas (or relative 0.0 - 1.0 coordinates).
"""
from pydantic import BaseModel


class RegionSpec(BaseModel):
    """Normalized relative spatial specification [0.0 - 1.0]."""
    x_min: float
    y_min: float
    width: float
    height: float
    aspect_ratio: float  # Nominal width / height (e.g. 35mm / 45mm = 0.778)
    tolerance: float = 0.08  # allowable deviation


class TD3PassportTemplate:
    """
    Standard TD3 Passport Physical Reference Proportions.
    Normalized to relative coordinates (0.0 to 1.0) so it works across any resolution.
    """
    # Standard ID-3 Dimensions (125mm x 88mm -> aspect ratio 1.420)
    STANDARD_ASPECT_RATIO = 125.0 / 88.0  # 1.42045
    ASPECT_RATIO_TOLERANCE = 0.04

    # Normalized Border Margins
    MARGIN_TOP = 0.045
    MARGIN_BOTTOM = 0.045
    MARGIN_LEFT = 0.032
    MARGIN_RIGHT = 0.032
    MARGIN_TOLERANCE = 0.025

    # Photo Box Specification (Standard 35mm x 45mm on 125mm x 88mm card -> ar = 35/45 = 0.778)
    PHOTO_SPEC = RegionSpec(
        x_min=0.056,
        y_min=0.204,
        width=0.208,
        height=0.386,
        aspect_ratio=35.0 / 45.0,  # ~0.7778
        tolerance=0.08
    )

    # Machine Readable Zone (MRZ) Nominal Band (Lower ~23-25%)
    MRZ_SPEC = RegionSpec(
        x_min=0.032,
        y_min=0.750,
        width=0.936,
        height=0.205,
        aspect_ratio=0.936 / 0.205,
        tolerance=0.15
    )

    # Visual Inspection Zone (VIZ) Text Column Offsets
    VIZ_COLUMN_1_X = 0.304  # Left text column
    VIZ_COLUMN_2_X = 0.624  # Right text column (if multi-column)
    VIZ_COLUMN_TOLERANCE = 0.06

    # Vertical Line Pitch (Nominal distance between consecutive field baselines)
    NOMINAL_LINE_PITCH = 0.0625  # ~55px on 880px height
    LINE_PITCH_TOLERANCE = 0.025

    # Skew / Angle Tolerances (degrees)
    MAX_ALLOWABLE_TEXT_SKEW_DEG = 1.2
    MAX_ALLOWABLE_MRZ_SKEW_DEG = 1.0


# Default global template instance
DEFAULT_TD3_TEMPLATE = TD3PassportTemplate()
