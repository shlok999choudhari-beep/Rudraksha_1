# VeriGuard AI — Complete Architecture & Verification Walkthrough

---

## 🏛️ Built Modules & Architecture

### 1. Document Ingestion & Perspective Normalization (`preprocessing/`, `geometry/transform.py`)
- Automatic 4-corner document detection and Homography Perspective Warping to a standardized ICAO ID-3 canvas ($1250 \times 880$).
- Laplacian blur score, glare ratio, illumination contrast, and EXIF orientation normalization.

### 2. ICAO Doc 9303 Checksum Engine (`mrz/checksum.py`)
- **Repeating Weights 7-3-1 Modulo 10 Algorithm**: Validates Document Number, Date of Birth, Expiry Date, Optional Data, and Composite Check Digits.
- Date parsing with century pivot heuristics and expiration tracking (`is_expired`, `expiring_soon`, `days_until_expiry`).

### 3. Multi-Format MRZ Parser (`mrz/parser.py`, `mrz/extractor.py`)
- Auto-detects and parses **TD3 Passports** ($2 \times 44$), **TD1 National IDs** ($3 \times 30$), and **TD2 Visas** ($2 \times 36$).
- Context-aware character disambiguation (`O` vs `0`, `I` vs `1`, `S` vs `5`, `«` vs `<`).

### 4. VIZ ↔ MRZ Cross-Validation Engine (`ocr/cross_validation.py`)
- Field-specific cross-referencing:
  - **Exact + Checksum**: Passport Number
  - **Exact Normalized Date**: Date of Birth & Date of Expiry
  - **Exact Code**: Nationality & Sex
  - **Normalized / Fuzzy Similarity**: Surname & Given Names
- Detects physical alterations and forged numbers with 3-tier risk calibration (`LOW`, `MEDIUM`, `HIGH`).

### 5. Passport Geometry & Layout Analysis Engine (`geometry/analysis.py`, `geometry/template.py`)
- **Document Aspect Ratio**: Verifies $125\text{mm} \times 88\text{mm} = 1.420 \pm 0.04$.
- **Photo Placement & Dimensions**: Measures photo bounding box, aspect ratio ($35\text{mm} / 45\text{mm} \approx 0.778$), and left border margin offset.
- **MRZ Spatial Positioning**: Validates lower ~25% band position, horizontal span, and parallelism.
- **Text Line Pitch Regularity**: Measures line-to-line spacing variance and field column alignment to catch pasted/spliced text.
- **Visual Overlays**: Generates SVG/Canvas bounding boxes and anomaly callouts for the frontend officer UI.

### 6. Forensic Tamper Detection Engine (`tampering/`)
- **Error Level Analysis (ELA)** ([`ela.py`](file:///C:/Users/shlok/.gemini/antigravity-ide/scratch/veriguard-ai/backend/app/tampering/ela.py)):
  - Recompression error amplification ($15\times$) and thermal heatmap generation (`Turbo`/`Jet`).
  - Localized anomaly cluster detection for spliced text and replaced photos.
- **Noise Inconsistency & Sensor Variance** ([`noise.py`](file:///C:/Users/shlok/.gemini/antigravity-ide/scratch/veriguard-ai/backend/app/tampering/noise.py)):
  - High-pass residual extraction ($R = I - \text{Median}(I)$).
  - Spatial noise variance mapping with statistical z-score outlier detection.
- **Copy-Move & Clone Localization** ([`copy_move.py`](file:///C:/Users/shlok/.gemini/antigravity-ide/scratch/veriguard-ai/backend/app/tampering/copy_move.py)):
  - ORB keypoint self-matching with displacement vector clustering.
  - Excludes repeating text/MRZ sequences while localizing macro duplicated stamps, signatures, and background patches.

### 7. Face Verification & Passive Liveness Engine (`face/`)
- **Document Face Extraction & Alignment** ([`extractor.py`](file:///C:/Users/shlok/.gemini/antigravity-ide/scratch/veriguard-ai/backend/app/face/extractor.py)):
  - Locates and crops normalized $160 \times 160$ face thumbnails from passport photos and live selfie captures.
- **1:1 Face Similarity Matcher & ArcFace ONNX Adapter** ([`matcher.py`](file:///C:/Users/shlok/.gemini/antigravity-ide/scratch/veriguard-ai/backend/app/face/matcher.py), [`arcface_onnx.py`](file:///C:/Users/shlok/.gemini/antigravity-ide/scratch/veriguard-ai/backend/app/face/arcface_onnx.py)):
  - 512-d deep embedding model with ONNX Runtime and zero-centered multi-scale CV feature fallback.
- **Passive Liveness & Anti-Spoofing** ([`liveness.py`](file:///C:/Users/shlok/.gemini/antigravity-ide/scratch/veriguard-ai/backend/app/face/liveness.py)):
  - 2D FFT Moire pattern detection for LCD/OLED screen replay attacks.
  - YCbCr chrominance dynamic range and micro-texture sharpness analysis for 2D printed photo attacks.

### 8. Master Screening Pipeline & 4-Layer Risk Engine (`risk/`)
- **Master Screening Endpoint** (`POST /api/documents/screen`):
  - Ingests passport image + optional live selfie.
  - Sequentially runs: $\text{Preprocessing} \to \text{Geometry} \to \text{Surya OCR} \to \text{ICAO 9303} \to \text{VIZ Cross-Check} \to \text{Forensics} \to \text{Biometrics}$.
- **4-Layer Trust & Risk Scoring** ([`scoring.py`](file:///C:/Users/shlok/.gemini/antigravity-ide/scratch/veriguard-ai/backend/app/risk/scoring.py)):
  1. **Layer 1: Document Physical & Geometric Integrity** (25% weight)
  2. **Layer 2: ICAO Doc 9303 Data Consistency** (30% weight)
  3. **Layer 3: Forensic Tampering & Security** (25% weight)
  4. **Layer 4: Biometric Identity & Anti-Spoofing** (20% weight)
  - Actionable Decision: `APPROVED_FOR_CLEARANCE`, `MANUAL_SUPERVISOR_REVIEW`, `SECONDARY_INSPECTION_REQUIRED`.

---

## 🧪 Test Verification Results (49 / 49 Passed)

```
============================= test session starts =============================
platform win32 -- Python 3.14.6, pytest-9.1.1
rootdir: C:\Users\shlok\.gemini\antigravity-ide\scratch\veriguard-ai

backend/tests/test_api.py::test_root_endpoint PASSED                     [  2%]
backend/tests/test_api.py::test_health_endpoint PASSED                   [  4%]
backend/tests/test_api.py::test_preprocess_endpoint PASSED               [  6%]
backend/tests/test_api.py::test_mrz_parse_endpoint PASSED                [  8%]
backend/tests/test_api.py::test_cross_validate_endpoint PASSED           [ 10%]
backend/tests/test_api.py::test_sample_synthetic_endpoint PASSED         [ 12%]
backend/tests/test_api.py::test_sample_synthetic_tampered_endpoint PASSED [ 14%]
backend/tests/test_cross_validation.py::test_cross_validation_matching PASSED [ 16%]
backend/tests/test_cross_validation.py::test_cross_validation_altered_document_number PASSED [ 18%]
backend/tests/test_cross_validation.py::test_cross_validation_altered_dob PASSED [ 20%]
backend/tests/test_cross_validation.py::test_string_similarity PASSED    [ 22%]
backend/tests/test_cross_validation.py::test_normalize_date PASSED       [ 24%]
backend/tests/test_face.py::test_face_extraction_and_fallback PASSED     [ 26%]
backend/tests/test_face.py::test_facial_embedding_extraction PASSED      [ 28%]
backend/tests/test_face.py::test_face_matching_same_person PASSED        [ 30%]
backend/tests/test_face.py::test_face_matching_different_person PASSED   [ 32%]
backend/tests/test_passive_liveness_on_natural_face PASSED [ 34%]
backend/tests/test_passive_liveness_on_screen_replay PASSED [ 36%]
backend/tests/test_face.py::test_full_identity_verification_orchestration PASSED [ 38%]
backend/tests/test_face.py::test_api_face_verify_endpoints PASSED        [ 40%]
backend/tests/test_geometry.py::test_bounding_box_calculations PASSED    [ 42%]
backend/tests/test_geometry.py::test_standard_passport_geometry_evaluation PASSED [ 44%]
backend/tests/test_geometry.py::test_geometry_with_displaced_photo PASSED [ 46%]
backend/tests/test_geometry.py::test_geometry_with_distorted_aspect_ratio PASSED [ 48%]
backend/tests/test_geometry.py::test_api_geometry_analyze_endpoint PASSED [ 51%]
backend/tests/test_mrz_checksum.py::test_character_values PASSED         [ 53%]
backend/tests/test_mrz_checksum.py::test_compute_check_digit_standard_vectors PASSED [ 55%]
backend/tests/test_mrz_checksum.py::test_verify_check_digit PASSED       [ 57%]
backend/tests/test_mrz_checksum.py::test_parse_mrz_date PASSED           [ 59%]
backend/tests/test_mrz_checksum.py::test_check_date_expiration PASSED    [ 61%]
backend/tests/test_mrz_parser.py::test_parse_td3_valid_passport PASSED   [ 63%]
backend/tests/test_mrz_parser.py::test_parse_td3_invalid_checksum PASSED [ 65%]
backend/tests/test_mrz_parser.py::test_parse_td1_national_id PASSED      [ 67%]
backend/tests/test_mrz_parser.py::test_auto_detect_mrz PASSED            [ 69%]
backend/tests/test_preprocessing.py::test_order_points PASSED            [ 71%]
backend/tests/test_preprocessing.py::test_quality_check_sharp_and_blurry PASSED [ 73%]
backend/tests/test_preprocessing.py::test_four_point_transform PASSED    [ 75%]
backend/tests/test_preprocessing.py::test_end_to_end_preprocessing PASSED [ 77%]
backend/tests/test_screening_pipeline.py::test_master_risk_score_calculation PASSED [ 79%]
backend/tests/test_screening_pipeline.py::test_screen_genuine_passport PASSED [ 81%]
backend/tests/test_screening_pipeline.py::test_screen_tampered_passport PASSED [ 83%]
backend/tests/test_screening_pipeline.py::test_screen_with_live_selfie PASSED [ 85%]
backend/tests/test_screening_pipeline.py::test_api_documents_screen_endpoint PASSED [ 87%]
backend/tests/test_tampering.py::test_compute_ela_image PASSED           [ 89%]
backend/tests/test_tampering.py::test_analyze_ela_on_clean_and_spliced PASSED [ 91%]
backend/tests/test_tampering.py::test_noise_variance_analysis PASSED     [ 93%]
backend/tests/test_tampering.py::test_copy_move_clones_detection PASSED  [ 95%]
backend/tests/test_tampering.py::test_full_document_tampering_pipeline PASSED [ 97%]
backend/tests/test_tampering.py::test_api_tampering_endpoints PASSED     [100%]

======================== 49 passed, 1 warning in 5.50s ========================
```
