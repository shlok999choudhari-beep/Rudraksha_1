"""
Supabase Client & Storage Adapter for VeriGuard AI.
Handles image uploads to Supabase Storage buckets:
- `veriguard-documents`: Scanned document passports/visas
- `veriguard-faces`: Document face crops and live webcam selfies
- `veriguard-heatmaps`: ELA tamper forensic heatmaps
"""
import os
import uuid
import base64
from typing import Optional, Tuple, Any
import cv2
import numpy as np

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")

_supabase_client: Optional[Any] = None


def get_supabase_client():
    """Initializes or retrieves the active Supabase client."""
    global _supabase_client
    if _supabase_client is None and SUPABASE_URL and SUPABASE_KEY and create_client:
        try:
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception:
            _supabase_client = None
    return _supabase_client


def is_supabase_enabled() -> bool:
    """Returns True if valid Supabase credentials are configured."""
    return bool(SUPABASE_URL and SUPABASE_KEY and get_supabase_client() is not None)


def upload_image_to_supabase(
    image: np.ndarray | bytes | str,
    bucket_name: str = "veriguard-documents",
    filename: Optional[str] = None
) -> Optional[str]:
    """
    Uploads an image (NumPy array, raw JPEG bytes, or base64 data URL) to Supabase Storage.
    Returns the public URL of the uploaded image asset, or None if offline.
    """
    client = get_supabase_client()
    if not client:
        return None

    if not filename:
        filename = f"{uuid.uuid4().hex[:12]}.jpg"

    raw_bytes: Optional[bytes] = None

    # Handle base64 string
    if isinstance(image, str):
        if image.startswith("data:"):
            _, encoded = image.split(",", 1)
            raw_bytes = base64.b64decode(encoded)
        else:
            raw_bytes = base64.b64decode(image)

    # Handle NumPy ndarray
    elif isinstance(image, np.ndarray):
        success, encoded_img = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        if success:
            raw_bytes = encoded_img.tobytes()

    # Handle raw bytes
    elif isinstance(image, bytes):
        raw_bytes = image

    if not raw_bytes:
        return None

    try:
        # Check / create bucket if needed
        res = client.storage.from_(bucket_name).upload(
            path=filename,
            file=raw_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
        # Get public URL
        url_res = client.storage.from_(bucket_name).get_public_url(filename)
        return url_res
    except Exception as e:
        # If upload fails or bucket does not exist, return None
        return None
