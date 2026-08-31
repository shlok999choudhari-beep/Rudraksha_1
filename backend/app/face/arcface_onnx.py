"""
Deep Learning Face Embedding Matcher using ONNX Runtime (ArcFace / MobileFaceNet).
Provides 512-dimensional deep feature embeddings with graceful fallback to multi-scale CV matcher.
"""
import os
import cv2
import numpy as np
from typing import Tuple, Optional

try:
    import onnxruntime as ort
    HAS_ONNX = True
except ImportError:
    HAS_ONNX = False

from backend.app.face.matcher import extract_facial_embedding_vector, compute_cosine_similarity, FaceMatchResult


class ArcFaceONNXEngine:
    """ArcFace Deep Learning Face Embedding Extractor."""

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or os.path.join(
            os.path.dirname(__file__), "..", "..", "models", "arcface_mobilefacenet.onnx"
        )
        self.session = None
        self.input_name = None
        self.output_name = None
        self._initialize_session()

    def _initialize_session(self):
        """Attempts to load ONNX model if file exists and ONNX runtime is available."""
        if HAS_ONNX and os.path.exists(self.model_path):
            try:
                opts = ort.SessionOptions()
                opts.intra_op_num_threads = 2
                self.session = ort.InferenceSession(
                    self.model_path,
                    sess_options=opts,
                    providers=["CPUExecutionProvider"]
                )
                self.input_name = self.session.get_inputs()[0].name
                self.output_name = self.session.get_outputs()[0].name
            except Exception:
                self.session = None

    @property
    def is_deep_model_active(self) -> bool:
        """Returns True if the deep ONNX neural model is loaded."""
        return self.session is not None

    def preprocess_face(self, face_img: np.ndarray, target_size: Tuple[int, int] = (112, 112)) -> np.ndarray:
        """Preprocesses face image for ArcFace (112x112, BGR->RGB, normalized to [-1, 1], NCHW)."""
        resized = cv2.resize(face_img, target_size, interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB) if len(resized.shape) == 3 else cv2.cvtColor(resized, cv2.COLOR_GRAY2RGB)
        # Normalize to [-1.0, 1.0]
        norm = (rgb.astype(np.float32) - 127.5) / 128.0
        # Transpose HWC to CHW and add batch dimension -> (1, 3, 112, 112)
        nchw = np.transpose(norm, (2, 0, 1))
        nchw = np.expand_dims(nchw, axis=0).astype(np.float32)
        return nchw

    def extract_embedding(self, face_img: np.ndarray) -> np.ndarray:
        """
        Extracts 512-dim normalized embedding vector.
        Uses ONNX ArcFace if model file is loaded, else uses built-in multi-scale extractor.
        """
        if self.is_deep_model_active:
            try:
                inp = self.preprocess_face(face_img)
                outputs = self.session.run([self.output_name], {self.input_name: inp})
                raw_emb = outputs[0][0]
                norm = np.linalg.norm(raw_emb)
                return raw_emb / (norm + 1e-6)
            except Exception:
                pass

        # Fallback to multi-scale CV feature embedding
        return extract_facial_embedding_vector(face_img)

    def compare_faces(
        self,
        doc_face: np.ndarray,
        live_face: np.ndarray,
        match_threshold: float = 0.70,
        uncertain_threshold: float = 0.50
    ) -> FaceMatchResult:
        """Compares document face and live face embeddings."""
        if doc_face is None or live_face is None:
            return FaceMatchResult(
                match_status="MISMATCH",
                similarity_score=0.0,
                cosine_distance=1.0,
                is_match=False,
                confidence=0.0,
                details="Missing face crop."
            )

        emb_doc = self.extract_embedding(doc_face)
        emb_live = self.extract_embedding(live_face)

        raw_sim = compute_cosine_similarity(emb_doc, emb_live)
        
        # Calibrate similarity
        baseline = 0.35 if not self.is_deep_model_active else 0.25
        calibrated_sim = float(np.clip((raw_sim - baseline) / (1.0 - baseline), 0.0, 1.0))
        calibrated_sim = round(calibrated_sim, 3)
        cosine_dist = round(1.0 - raw_sim, 3)

        if calibrated_sim >= match_threshold:
            status = "MATCH"
            is_match = True
            conf = round(min(1.0, 0.70 + (calibrated_sim - match_threshold) * 1.5), 2)
            model_info = "ArcFace Deep ONNX" if self.is_deep_model_active else "Multi-Scale Vision Engine"
            details = f"Face match confirmed via {model_info} ({calibrated_sim:.1%} similarity)."
        elif calibrated_sim >= uncertain_threshold:
            status = "UNCERTAIN"
            is_match = False
            conf = 0.55
            details = f"Face similarity borderline ({calibrated_sim:.1%}). Manual review recommended."
        else:
            status = "MISMATCH"
            is_match = False
            conf = round(min(1.0, 0.75 + (uncertain_threshold - calibrated_sim) * 1.5), 2)
            details = f"Face similarity low ({calibrated_sim:.1%}). Document photo does not match live face."

        return FaceMatchResult(
            match_status=status,
            similarity_score=calibrated_sim,
            cosine_distance=cosine_dist,
            is_match=is_match,
            confidence=conf,
            details=details
        )


# Global singleton instance
arcface_engine = ArcFaceONNXEngine()
