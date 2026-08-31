"""
Forensic Image Tampering Detection Module for VeriGuard AI.
Implements Error Level Analysis (ELA), Noise Inconsistency Maps,
Copy-Move Clone Localization, and multi-modal forensic risk aggregation.
"""
from backend.app.tampering.ela import (
    compute_ela_image,
    detect_ela_suspicious_regions,
    analyze_ela,
    ELAResult
)
from backend.app.tampering.noise import (
    extract_noise_residual,
    compute_local_noise_variance_map,
    detect_noise_discrepancies,
    analyze_noise_inconsistency,
    NoiseAnalysisResult
)
from backend.app.tampering.copy_move import (
    detect_copy_move_clones,
    analyze_copy_move,
    CopyMoveResult,
    ClonedRegionPair
)
from backend.app.tampering.detector import (
    analyze_document_tampering,
    ForensicTamperReport,
    generate_composite_tamper_overlay
)

__all__ = [
    "compute_ela_image",
    "detect_ela_suspicious_regions",
    "analyze_ela",
    "ELAResult",
    "extract_noise_residual",
    "compute_local_noise_variance_map",
    "detect_noise_discrepancies",
    "analyze_noise_inconsistency",
    "NoiseAnalysisResult",
    "detect_copy_move_clones",
    "analyze_copy_move",
    "CopyMoveResult",
    "ClonedRegionPair",
    "analyze_document_tampering",
    "ForensicTamperReport",
    "generate_composite_tamper_overlay"
]
