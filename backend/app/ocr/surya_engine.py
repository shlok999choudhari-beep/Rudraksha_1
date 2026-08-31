"""
Surya OCR & Document Layout Recognition Engine.
Performs text line detection, polygon segmentation, character recognition,
and extracts both Visual Inspection Zone (VIZ) fields and Machine Readable Zone (MRZ) lines.
"""
import re
import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional, Any
from pydantic import BaseModel, Field

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
    """Multi-Backend Neural & Layout OCR Document Processor (EasyOCR / Surya / PyTesseract)."""

    def __init__(self, use_gpu: bool = False):
        self.use_gpu = use_gpu
        self._easyocr_reader = None
        self._surya_loaded = False

    def _get_easyocr_reader(self):
        if self._easyocr_reader is None:
            try:
                import torch
                import easyocr
                torch.set_num_threads(2)
                self._easyocr_reader = easyocr.Reader(['en'], gpu=self.use_gpu, verbose=False, quantize=False)
            except Exception:
                self._easyocr_reader = False
        return self._easyocr_reader if self._easyocr_reader is not False else None

    def _try_load_surya(self):
        if not self._surya_loaded:
            try:
                from surya.ocr import run_ocr
                from surya.model.detection.model import load_model as load_det_model, load_processor as load_det_proc
                from surya.model.recognition.model import load_model as load_rec_model, load_processor as load_rec_proc
                self.run_ocr_fn = run_ocr
                self.det_model = load_det_model()
                self.det_processor = load_det_proc()
                self.rec_model = load_rec_model()
                self.rec_processor = load_rec_proc()
                self._surya_loaded = True
            except Exception:
                self._surya_loaded = False
        return self._surya_loaded

    def detect_and_read_text(self, image: np.ndarray) -> OCRDocumentLayoutResult:
        """
        Executes OCR line detection and field extraction across normalized document canvas.
        """
        if image is None or image.size == 0:
            raise ValueError("Invalid document image.")

        h, w = image.shape[:2]
        text_lines: List[TextLineBBox] = []
        raw_lines: List[str] = []
        engine_name = "VeriGuard OCR & Layout Engine"

        # 1. Memory-Safe Inference via EasyOCR
        easy_reader = self._get_easyocr_reader()
        if easy_reader is not None:
            try:
                import torch
                import gc
                engine_name = "EasyOCR Neural Engine"

                # Downscale high-res input canvas if needed to keep working memory low
                ocr_input = image
                scale_back_x = 1.0
                scale_back_y = 1.0
                if max(h, w) > 1200:
                    scale = 1200.0 / max(h, w)
                    ocr_input = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
                    scale_back_x = w / ocr_input.shape[1]
                    scale_back_y = h / ocr_input.shape[0]

                with torch.inference_mode():
                    results = easy_reader.readtext(
                        ocr_input,
                        batch_size=1,
                        canvas_size=1200,
                        mag_ratio=1.0,
                        workers=0
                    )

                for (bbox_pts, text, conf) in results:
                    clean_t = text.strip()
                    if clean_t:
                        # Convert 4-point polygon to original image coordinates
                        xs = [p[0] * scale_back_x for p in bbox_pts]
                        ys = [p[1] * scale_back_y for p in bbox_pts]
                        bx, by, bw, bh = int(min(xs)), int(min(ys)), int(max(xs) - min(xs)), int(max(ys) - min(ys))
                        text_lines.append(TextLineBBox(
                            text=clean_t,
                            confidence=round(float(conf), 2),
                            bbox={"x": bx, "y": by, "w": bw, "h": bh},
                            polygon=[[int(p[0] * scale_back_x), int(p[1] * scale_back_y)] for p in bbox_pts]
                        ))
                        raw_lines.append(clean_t)
                gc.collect()
            except Exception:
                pass

        # 2. Inference via Surya OCR
        elif self._try_load_surya():
            try:
                from PIL import Image
                engine_name = "Surya Neural OCR"
                pil_img = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
                predictions = self.run_ocr_fn(
                    [pil_img],
                    [['en']],
                    self.det_model,
                    self.det_processor,
                    self.rec_model,
                    self.rec_processor
                )
                if predictions and len(predictions) > 0:
                    for line in predictions[0].text_lines:
                        clean_t = line.text.strip()
                        if clean_t:
                            bbox = {
                                "x": int(line.bbox[0]),
                                "y": int(line.bbox[1]),
                                "w": int(line.bbox[2] - line.bbox[0]),
                                "h": int(line.bbox[3] - line.bbox[1])
                            }
                            text_lines.append(TextLineBBox(
                                text=clean_t,
                                confidence=round(float(line.confidence), 2),
                                bbox=bbox,
                                polygon=line.polygon if hasattr(line, 'polygon') else None
                            ))
                            raw_lines.append(clean_t)
            except Exception:
                pass

        # 3. Extract MRZ Lines from OCR output lines or via morphological candidate detector
        mrz_candidate_lines = [
            l.text.replace(' ', '').upper()
            for l in text_lines
            if len(l.text.replace(' ', '')) >= 25 and ('<' in l.text or l.text.startswith('P<') or l.text.startswith('V<') or l.text.startswith('I<'))
        ]

        if not mrz_candidate_lines:
            # Fallback to Morphological / OCR-B Character Extractor
            mrz_res = extract_and_parse_mrz_from_image(image)
            if mrz_res.mrz_lines:
                mrz_candidate_lines = mrz_res.mrz_lines

        # 4. Parse MRZ
        mrz_parsed = None
        if mrz_candidate_lines and len(mrz_candidate_lines) >= 2:
            try:
                mrz_parsed = parse_mrz(mrz_candidate_lines)
            except Exception:
                pass

        # 5. Extract / Derive VIZ Data Payload dynamically from text lines
        viz_data = self._extract_viz_from_lines_and_mrz(text_lines, mrz_parsed)

        return OCRDocumentLayoutResult(
            raw_text="\n".join(raw_lines) if raw_lines else "\n".join(mrz_candidate_lines),
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
        with fallback to parsed MRZ values.
        """
        # Baseline fallback from MRZ if available, otherwise empty string
        passport_no = mrz_parsed.document_number if mrz_parsed else ""
        surname = mrz_parsed.surname if mrz_parsed else ""
        given_names = mrz_parsed.given_names if mrz_parsed else ""
        dob = str(mrz_parsed.date_of_birth) if (mrz_parsed and mrz_parsed.date_of_birth) else ""
        expiry = str(mrz_parsed.date_of_expiry) if (mrz_parsed and mrz_parsed.date_of_expiry) else ""
        nationality = mrz_parsed.nationality if mrz_parsed else ""
        sex = mrz_parsed.sex if mrz_parsed else ""

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
