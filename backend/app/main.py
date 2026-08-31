"""VeriGuard AI API Server Entrypoint."""
import os
import io
import base64
import uuid
import cv2
import numpy as np
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

from backend.app.preprocessing.image import (
    preprocess_document,
    read_image_with_orientation,
    STANDARD_TARGET_WIDTH,
    STANDARD_TARGET_HEIGHT,
    STANDARD_PASSPORT_ASPECT_RATIO,
)
from backend.app.preprocessing.quality import check_image_quality
from backend.app.mrz import (
    parse_mrz,
    extract_and_parse_mrz_from_image,
    crop_mrz_region,
    preprocess_mrz_for_ocr,
    compute_check_digit,
    verify_check_digit,
    MRZParsedResult
)
from backend.app.ocr import (
    cross_validate_viz_and_mrz,
    VIZDataPayload,
    CrossValidationReport
)
from backend.app.geometry import (
    evaluate_passport_geometry,
    PassportGeometryReport,
    DEFAULT_TD3_TEMPLATE
)
from backend.app.tampering import (
    analyze_document_tampering,
    analyze_ela,
    analyze_noise_inconsistency,
    analyze_copy_move,
    ForensicTamperReport,
    ELAResult,
    NoiseAnalysisResult,
    CopyMoveResult
)
from backend.app.face import (
    verify_identity_and_liveness,
    evaluate_passive_liveness,
    FaceVerificationReport,
    LivenessResult
)
from backend.app.risk import (
    screen_document_and_identity,
    MasterScreeningReport
)
from data.synthetic.generate_sample import (
    generate_synthetic_passport,
    generate_tampered_synthetic_passport
)

# Initialize FastAPI application
app = FastAPI(
    title="VeriGuard AI API",
    description="AI-Assisted Identity & Document Integrity Screening System",
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure required runtime directories exist
os.makedirs("data/raw", exist_ok=True)
os.makedirs("data/processed", exist_ok=True)
os.makedirs("data/synthetic", exist_ok=True)

# Mount static file routes for processed and synthetic data
app.mount("/static/processed", StaticFiles(directory="data/processed"), name="processed_data")
app.mount("/static/synthetic", StaticFiles(directory="data/synthetic"), name="synthetic_data")


# Request/Response DTOs
class MRZParseRequest(BaseModel):
    mrz_text: Optional[str] = None
    mrz_lines: Optional[List[str]] = None


class CrossValidateRequest(BaseModel):
    viz: VIZDataPayload
    mrz_lines: Optional[List[str]] = None
    mrz_text: Optional[str] = None


@app.get("/")
def root():
    """Root landing endpoint with system status."""
    return {
        "service": "VeriGuard AI Screening Backend",
        "version": "0.2.0",
        "status": "online",
        "docs": "/docs",
        "modules": {
            "milestone1_preprocessing": "operational",
            "milestone2_mrz_and_ocr": "operational",
            "milestone3_tamper_forensics": "in_development",
            "milestone4_face_and_liveness": "in_development",
            "milestone5_risk_engine": "in_development"
        }
    }


@app.get("/health")
def health_check():
    """Health check endpoint to verify backend operational status."""
    return {
        "status": "ok",
        "service": "veriguard-ai",
        "components": {
            "api": "healthy",
            "preprocessing": "operational",
            "geometry_engine": "operational",
            "mrz_engine": "operational",
            "ocr_cross_validation": "operational",
            "tamper_forensics": "operational",
            "face_verification": "operational",
            "master_risk_engine": "operational"
        }
    }


# =========================================================================
# Master Multi-Modal Screening Pipeline Endpoint
# =========================================================================

@app.post("/api/documents/screen", response_model=MasterScreeningReport)
async def screen_document_endpoint(
    document_file: UploadFile = File(...),
    selfie_file: Optional[UploadFile] = File(None)
):
    """
    Master Identity & Document Screening Endpoint:
    Executes end-to-end 7-stage screening across:
    1. Preprocessing & Perspective Warping
    2. ICAO Geometry & Margin Analysis
    3. Surya OCR & Layout Recognition
    4. ICAO Doc 9303 Checksum Validation
    5. VIZ <-> MRZ Cross-Validation
    6. ELA & Sensor Noise Forensic Tamper Localization
    7. Face Verification & Passive Liveness (if selfie uploaded)
    
    Returns full 4-Layer Trust & Risk Report with interactive visual overlays.
    """
    try:
        doc_content = await document_file.read()
        if not doc_content:
            raise HTTPException(status_code=400, detail="Document image file is empty.")

        doc_img = cv2.imdecode(np.frombuffer(doc_content, np.uint8), cv2.IMREAD_COLOR)
        if doc_img is None:
            raise HTTPException(status_code=400, detail="Invalid document image.")

        live_img = None
        if selfie_file is not None:
            selfie_content = await selfie_file.read()
            if selfie_content:
                live_img = cv2.imdecode(np.frombuffer(selfie_content, np.uint8), cv2.IMREAD_COLOR)

        report = screen_document_and_identity(doc_img, live_img)
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Master screening failed: {str(e)}")



# =========================================================================
# MILESTONE 1: Document Ingestion & Perspective Preprocessing Endpoints
# =========================================================================

@app.post("/api/documents/preprocess")
async def preprocess_document_endpoint(
    file: UploadFile = File(...),
    target_width: int = Form(STANDARD_TARGET_WIDTH),
    enhance_contrast: bool = Form(False)
):
    """
    Receives an uploaded document image, performs quality checks,
    detects document corners, applies perspective warping, and returns normalized output.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        doc_id = str(uuid.uuid4())[:8]
        raw_filename = f"{doc_id}_{file.filename}"
        raw_path = os.path.join("data/raw", raw_filename)
        processed_filename = f"processed_{doc_id}.jpg"
        processed_path = os.path.join("data/processed", processed_filename)

        with open(raw_path, "wb") as f:
            f.write(content)

        result = preprocess_document(
            input_source=content,
            output_path=processed_path,
            target_width=target_width,
            enhance_contrast=enhance_contrast
        )

        if not result.success or result.processed_image is None:
            raise HTTPException(status_code=422, detail=result.error_message or "Preprocessing failed.")

        _, buffer = cv2.imencode(".jpg", result.processed_image)
        b64_image = base64.b64encode(buffer).decode("utf-8")

        return {
            "document_id": doc_id,
            "success": True,
            "quality": result.quality_report.to_dict(),
            "corners_detected": result.corners_detected,
            "detection_confidence": result.detection_confidence,
            "original_size": result.original_size,
            "processed_size": result.processed_size,
            "processing_time_ms": result.processing_time_ms,
            "image_url": f"/static/processed/{processed_filename}",
            "base64_image": f"data:image/jpeg;base64,{b64_image}"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal preprocessing error: {str(e)}")


# =========================================================================
# MILESTONE 2: MRZ Parsing, Checksums, & OCR Cross-Validation Endpoints
# =========================================================================

@app.post("/api/mrz/parse", response_model=MRZParsedResult)
def parse_mrz_endpoint(payload: MRZParseRequest):
    """
    Parses raw MRZ text or lines for TD1 (National ID), TD2 (Visa), or TD3 (Passport)
    and verifies all ICAO 9303 7-3-1 modulus 10 check digits.
    """
    input_data = payload.mrz_lines if payload.mrz_lines else payload.mrz_text
    if not input_data:
        raise HTTPException(status_code=400, detail="Either mrz_text or mrz_lines must be provided.")

    result = parse_mrz(input_data)
    return result


@app.post("/api/documents/mrz-extract")
async def extract_mrz_endpoint(file: UploadFile = File(...)):
    """
    Uploads a document image, locates the MRZ region, applies morphological
    enhancement, and extracts MRZ lines and parsed checksums.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        nparr = np.frombuffer(content, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid or unreadable image file.")

        extraction = extract_and_parse_mrz_from_image(img)

        # Crop MRZ preview image for UI display
        mrz_crop, bbox = crop_mrz_region(img)
        _, crop_buffer = cv2.imencode(".jpg", mrz_crop)
        b64_crop = base64.b64encode(crop_buffer).decode("utf-8")

        return {
            "success": extraction.success,
            "mrz_text": extraction.mrz_text,
            "mrz_lines": extraction.mrz_lines,
            "parsed_data": extraction.parsed_data,
            "bounding_box": bbox,
            "mrz_crop_base64": f"data:image/jpeg;base64,{b64_crop}",
            "error_message": extraction.error_message
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MRZ extraction failed: {str(e)}")


@app.post("/api/documents/cross-validate", response_model=CrossValidationReport)
def cross_validate_endpoint(payload: CrossValidateRequest):
    """
    Cross-validates extracted human-readable Visual Inspection Zone (VIZ) data
    against parsed MRZ records to identify alterations or counterfeit documents.
    """
    mrz_input = payload.mrz_lines if payload.mrz_lines else payload.mrz_text
    if not mrz_input:
        raise HTTPException(status_code=400, detail="MRZ data must be provided for cross-validation.")

    mrz_result = parse_mrz(mrz_input)
    report = cross_validate_viz_and_mrz(payload.viz, mrz_result)
    return report


# =========================================================================
# Geometry & Layout Analysis Endpoints
# =========================================================================

@app.post("/api/geometry/analyze", response_model=PassportGeometryReport)
async def analyze_geometry_endpoint(file: UploadFile = File(...)):
    """
    Analyzes normalized passport image geometry, measuring margins, photo placement,
    MRZ positioning, and text line pitch regularity against standard ICAO TD3 templates.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        nparr = np.frombuffer(content, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid or unreadable image file.")

        report = evaluate_passport_geometry(img)
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geometry analysis failed: {str(e)}")


# =========================================================================
# Forensic Image Tamper Detection Endpoints
# =========================================================================

@app.post("/api/tampering/analyze", response_model=ForensicTamperReport)
async def analyze_tampering_endpoint(file: UploadFile = File(...)):
    """
    Comprehensive forensic tampering analysis:
    Executes Error Level Analysis (ELA), Sensor Noise Variance mapping,
    and Copy-Move Clone localization to detect digital alterations and spliced elements.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        nparr = np.frombuffer(content, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid or unreadable image file.")

        report = analyze_document_tampering(img)
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tampering analysis failed: {str(e)}")


@app.post("/api/tampering/ela", response_model=ELAResult)
async def analyze_ela_endpoint(file: UploadFile = File(...)):
    """Runs isolated Error Level Analysis (ELA) and returns error heatmap."""
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        nparr = np.frombuffer(content, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid or unreadable image file.")

        result = analyze_ela(img)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ELA analysis failed: {str(e)}")


@app.post("/api/tampering/noise", response_model=NoiseAnalysisResult)
async def analyze_noise_endpoint(file: UploadFile = File(...)):
    """Runs isolated Noise Variance Inconsistency Analysis and returns noise map."""
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        nparr = np.frombuffer(content, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid or unreadable image file.")

        result = analyze_noise_inconsistency(img)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Noise analysis failed: {str(e)}")


# =========================================================================
# Face Verification & Passive Liveness Endpoints
# =========================================================================

@app.post("/api/face/verify", response_model=FaceVerificationReport)
async def verify_face_endpoint(
    doc_file: UploadFile = File(...),
    live_file: UploadFile = File(...)
):
    """
    1:1 Face Verification & Passive Anti-Spoofing:
    Matches passport photo against live selfie capture and performs
    Moire pattern and skin texture presentation attack detection.
    """
    try:
        doc_content = await doc_file.read()
        live_content = await live_file.read()

        if not doc_content or not live_content:
            raise HTTPException(status_code=400, detail="Both document and live selfie images are required.")

        doc_img = cv2.imdecode(np.frombuffer(doc_content, np.uint8), cv2.IMREAD_COLOR)
        live_img = cv2.imdecode(np.frombuffer(live_content, np.uint8), cv2.IMREAD_COLOR)

        if doc_img is None or live_img is None:
            raise HTTPException(status_code=400, detail="Could not decode uploaded images.")

        report = verify_identity_and_liveness(doc_img, live_img)
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face verification failed: {str(e)}")


@app.post("/api/face/liveness", response_model=LivenessResult)
async def check_liveness_endpoint(file: UploadFile = File(...)):
    """Runs isolated Passive Liveness Presentation Attack Detection on a selfie image."""
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        img = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file.")

        result = evaluate_passive_liveness(img)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Liveness evaluation failed: {str(e)}")


# =========================================================================
# Synthetic Test Document Endpoints
# =========================================================================

@app.get("/api/documents/sample-synthetic")
def get_sample_synthetic():
    """Generates and serves a genuine synthetic test document for pipeline testing."""
    sample_path = generate_synthetic_passport(tilt_and_place=True)
    return {
        "message": "Synthetic sample generated successfully",
        "file_path": sample_path,
        "sample_url": "/static/synthetic/sample_tilted_passport.jpg"
    }


@app.get("/api/documents/sample-synthetic-tampered")
def get_sample_synthetic_tampered(tamper_type: str = "number_mismatch"):
    """Generates and serves a synthetic document with deliberate tampering."""
    sample_path = generate_tampered_synthetic_passport(tamper_type=tamper_type)
    return {
        "message": f"Tampered synthetic sample ({tamper_type}) generated successfully",
        "tamper_type": tamper_type,
        "file_path": sample_path,
        "sample_url": f"/static/synthetic/{os.path.basename(sample_path)}"
    }
