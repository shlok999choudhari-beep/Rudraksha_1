"""
Surya OCR & Document Layout Recognition Engine.
Performs text line detection, polygon segmentation, character recognition,
and extracts both Visual Inspection Zone (VIZ) fields and Machine Readable Zone (MRZ) lines.
"""
import os
import re
import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional, Any
from pydantic import BaseModel, Field

# Ensure Tesseract finds bundled traineddata across cloud environments
_TESSDATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "tessdata"))
if os.path.exists(_TESSDATA_DIR):
    os.environ["TESSDATA_PREFIX"] = _TESSDATA_DIR

from backend.app.ocr.cross_validation import VIZDataPayload
from backend.app.mrz.parser import parse_mrz, MRZParsedResult
from backend.app.mrz.extractor import crop_mrz_region, extract_and_parse_mrz_from_image





class TextLineBBox(BaseModel):
    """Detected text line with bounding box coordinates, polygon, and transcription."""
    text: str
    confidence: float
    bbox: Dict[str, int]  # x, y, w, h
    polygon: Optional[List[List[int]]] = None


class OCRDocumentLayoutResult(BaseModel):
    """Complete structured output from Surya OCR and Layout Analysis."""
    raw_text: str
    text_lines: List[TextLineBBox] = []
    viz_data: VIZDataPayload
    detected_mrz_lines: List[str] = []
    mrz_parsed_result: Optional[MRZParsedResult] = None
    engine_name: str = "Surya OCR & Layout Engine"


class SuryaOCREngine:
    """Clean EasyOCR Document Processor."""

    def __init__(self, use_gpu: bool = False):
        self.use_gpu = use_gpu
        self._easyocr_reader = None

    def _get_reader(self):
        if self._easyocr_reader is None:
            try:
                import torch
                import easyocr
                torch.set_num_threads(2)
                self._easyocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            except Exception as e:
                print(f"[OCR] EasyOCR init error: {e}")
                self._easyocr_reader = False
        return self._easyocr_reader if self._easyocr_reader is not False else None

    def detect_and_read_text(self, image: np.ndarray) -> OCRDocumentLayoutResult:
        """
        Runs EasyOCR on image canvas and outputs text lines with bounding boxes.
        """
        if image is None or image.size == 0:
            return OCRDocumentLayoutResult(
                raw_text="",
                text_lines=[],
                viz_data=VIZDataPayload(),
                engine_name="EasyOCR Engine"
            )

        text_lines: List[TextLineBBox] = []
        raw_lines: List[str] = []
        mrz_candidate_lines: List[str] = []
        engine_name = "EasyOCR Engine"

        reader = self._get_reader()
        if reader is not None:
            try:
                results = reader.readtext(image)
                h, w = image.shape[:2]
                mrz_y_threshold = int(h * 0.70)

                for bbox, text, conf in results:
                    t = text.strip()
                    if not t or float(conf) < 0.15:
                        continue

                    pts = np.array(bbox, dtype=np.int32)
                    bx = int(np.min(pts[:, 0]))
                    by = int(np.min(pts[:, 1]))
                    bw = int(np.max(pts[:, 0]) - bx)
                    bh = int(np.max(pts[:, 1]) - by)

                    text_lines.append(TextLineBBox(
                        text=t,
                        confidence=round(float(conf), 2),
                        bbox={"x": bx, "y": by, "w": bw, "h": bh},
                        polygon=pts.tolist()
                    ))
                    raw_lines.append(t)

                    # Check if line belongs in bottom MRZ band
                    if by >= mrz_y_threshold:
                        cleaned = re.sub(r'[\r\n\t ]+', '', t).upper()
                        if len(cleaned) >= 20:
                            mrz_candidate_lines.append(cleaned)
            except Exception as e:
                print(f"[OCR] EasyOCR execution failed: {e}")

        # Parse MRZ lines if found in bottom zone
        mrz_parsed = None
        if len(mrz_candidate_lines) >= 2:
            try:
                mrz_parsed = parse_mrz(mrz_candidate_lines[-2:])
            except Exception:
                pass

        # Synthesize VIZ Data
        viz_data = self._extract_viz_from_lines_and_mrz(text_lines, mrz_parsed)

        return OCRDocumentLayoutResult(
            raw_text="\n".join(raw_lines),
            text_lines=text_lines,
            viz_data=viz_data,
            detected_mrz_lines=mrz_candidate_lines,
            mrz_parsed_result=mrz_parsed,
            engine_name=engine_name
        )


    def _extract_viz_from_lines_and_mrz(
        self,
        text_lines: List[TextLineBBox],
        mrz_parsed: Optional[MRZParsedResult]
    ) -> VIZDataPayload:
        """
        Synthesizes structured VIZ fields by parsing recognized 2D text layout patterns,
        with fallback to parsed MRZ values or document visual anchors.
        """
        passport_no = mrz_parsed.document_number if (mrz_parsed and mrz_parsed.document_number) else ""
        surname = mrz_parsed.surname if (mrz_parsed and mrz_parsed.surname) else ""
        given_names = mrz_parsed.given_names if (mrz_parsed and mrz_parsed.given_names) else ""
        dob = str(mrz_parsed.date_of_birth) if (mrz_parsed and mrz_parsed.date_of_birth) else ""
        expiry = str(mrz_parsed.date_of_expiry) if (mrz_parsed and mrz_parsed.date_of_expiry) else ""
        nationality = mrz_parsed.nationality if (mrz_parsed and mrz_parsed.nationality) else ""
        sex = mrz_parsed.sex if (mrz_parsed and mrz_parsed.sex) else ""

        # Map of visual labels to search for
        label_keywords_map = {
            'doc_num': ['Passport No', 'Passeport No', 'Doc No', 'Document No', 'Passport Number'],
            'surname': ['Surname', 'Nom'],
            'given_names': ['Given Names', 'Prenoms', 'Given Name'],
            'nationality': ['Nationality', 'Nationalite'],
            'dob': ['Date of Birth', 'Date de Naissance', 'Birth'],
            'sex': ['Sex', 'Sexe'],
            'expiry': ['Date of Expiry', 'Date dExpiration', 'Expiry', 'Expiration'],
        }

        # Spatial layout matching for multi-column documents
        boxes = []
        for line in text_lines:
            bx = line.bbox.get('x', 0)
            by = line.bbox.get('y', 0)
            bw = line.bbox.get('w', 0)
            bh = line.bbox.get('h', 0)
            boxes.append({
                'text': line.text.strip(),
                'bx': bx,
                'by': by,
                'bw': bw,
                'bh': bh,
                'conf': line.confidence
            })

        for field_key, keywords in label_keywords_map.items():
            best_lbl = None
            for b in boxes:
                # Exclude MRZ region at bottom (y > 600 in normalized scale)
                if b['by'] > 600:
                    continue
                for kw in keywords:
                    if kw.upper() in b['text'].upper():
                        best_lbl = b
                        break
                if best_lbl:
                    break

            if best_lbl:
                val_candidates = []
                for b in boxes:
                    if b == best_lbl or b['by'] > 600:
                        continue
                    # Check if box is another label
                    is_other_lbl = any(
                        kw.upper() in b['text'].upper()
                        for kws in label_keywords_map.values()
                        for kw in kws
                    )
                    if is_other_lbl:
                        continue

                    dy = b['by'] - (best_lbl['by'] + best_lbl['bh'])
                    dx = abs(b['bx'] - best_lbl['bx'])
                    if -5 <= dy <= 45 and dx <= 70:
                        val_candidates.append((dy, dx, b))

                if val_candidates:
                    val_candidates.sort(key=lambda item: item[0] + item[1] * 0.2)
                    matched_val = val_candidates[0][2]['text'].strip()

                    if field_key == 'doc_num' and matched_val:
                        passport_no = matched_val
                    elif field_key == 'surname' and matched_val:
                        surname = matched_val
                    elif field_key == 'given_names' and matched_val:
                        given_names = matched_val
                    elif field_key == 'nationality' and matched_val:
                        nationality = matched_val
                    elif field_key == 'dob' and matched_val:
                        dob = matched_val
                    elif field_key == 'sex' and matched_val:
                        cleaned_sex = matched_val.upper().strip()
                        if cleaned_sex in ('M', 'F', 'X', 'MALE', 'FEMALE'):
                            sex = 'M' if cleaned_sex.startswith('M') else ('F' if cleaned_sex.startswith('F') else 'X')
                        elif mrz_parsed and mrz_parsed.sex:
                            sex = mrz_parsed.sex
                    elif field_key == 'expiry' and matched_val:
                        expiry = matched_val

        # Fallback document number regex scan if still empty
        if not passport_no:
            for b in boxes:
                if re.match(r'^[A-Z][0-9]{7,8}$', b['text']):
                    passport_no = b['text']
                    break

        return VIZDataPayload(
            document_number=passport_no,
            surname=surname,
            given_names=given_names,
            date_of_birth=dob,
            date_of_expiry=expiry,
            nationality=nationality,
            sex=sex
        )


# Global singleton instance
surya_engine = SuryaOCREngine()
