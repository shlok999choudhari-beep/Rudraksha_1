"""VeriGuard AI API Server Entrypoint."""
import os
import io
import base64
import uuid
import cv2
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse

from backend.app.preprocessing.image import (
    preprocess_document,
    read_image_with_orientation,
    STANDARD_TARGET_WIDTH,
    STANDARD_TARGET_HEIGHT,
    STANDARD_PASSPORT_ASPECT_RATIO,
)
from backend.app.preprocessing.quality import check_image_quality
from data.synthetic.generate_sample import generate_synthetic_passport

# Initialize FastAPI application
app = FastAPI(
    title="VeriGuard AI API",
    description="AI-Assisted Identity & Document Integrity Screening System",
    version="0.1.0",
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


@app.get("/")
def root():
    """Root landing endpoint with system status."""
    return {
        "service": "VeriGuard AI Screening Backend",
        "version": "0.1.0",
        "status": "online",
        "docs": "/docs",
        "pipeline_stages": [
            "preprocessing",
            "ocr_extraction",
            "mrz_validation",
            "tamper_detection",
            "face_verification",
            "liveness_check",
            "risk_engine"
        ]
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
            "geometry_engine": "operational"
        }
    }


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

        # Generate unique case ID
        doc_id = str(uuid.uuid4())[:8]
        raw_filename = f"{doc_id}_{file.filename}"
        raw_path = os.path.join("data/raw", raw_filename)
        processed_filename = f"processed_{doc_id}.jpg"
        processed_path = os.path.join("data/processed", processed_filename)

        # Save raw uploaded image
        with open(raw_path, "wb") as f:
            f.write(content)

        # Run preprocessing pipeline
        result = preprocess_document(
            input_source=content,
            output_path=processed_path,
            target_width=target_width,
            enhance_contrast=enhance_contrast
        )

        if not result.success or result.processed_image is None:
            raise HTTPException(status_code=422, detail=result.error_message or "Preprocessing failed.")

        # Encode processed image to base64 for direct frontend rendering
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


@app.get("/api/documents/sample-synthetic")
def get_sample_synthetic():
    """Generates and serves a synthetic test document for pipeline testing."""
    sample_path = generate_synthetic_passport(tilt_and_place=True)
    return {
        "message": "Synthetic sample generated successfully",
        "file_path": sample_path,
        "sample_url": "/static/synthetic/sample_tilted_passport.jpg"
    }
