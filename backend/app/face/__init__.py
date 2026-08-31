"""
Face Verification and Passive Liveness Module for VeriGuard AI.
Handles face extraction, 1:1 facial embedding matching, and passive presentation attack detection.
"""
from backend.app.face.extractor import (
    extract_face_crop,
    DetectedFace
)
from backend.app.face.matcher import (
    verify_face_match,
    extract_facial_embedding_vector,
    compute_cosine_similarity,
    FaceMatchResult
)
from backend.app.face.liveness import (
    evaluate_passive_liveness,
    compute_fft_moire_pattern_score,
    compute_skin_chroma_diversity_score,
    LivenessResult
)
from backend.app.face.verifier import (
    verify_identity_and_liveness,
    FaceVerificationReport,
    encode_image_to_base64
)

__all__ = [
    "extract_face_crop",
    "DetectedFace",
    "verify_face_match",
    "extract_facial_embedding_vector",
    "compute_cosine_similarity",
    "FaceMatchResult",
    "evaluate_passive_liveness",
    "compute_fft_moire_pattern_score",
    "compute_skin_chroma_diversity_score",
    "LivenessResult",
    "verify_identity_and_liveness",
    "FaceVerificationReport",
    "encode_image_to_base64"
]
