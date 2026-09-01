"""
EXIF and Image Container Metadata Forensics Engine.
Extracts camera metadata, software editing signatures (e.g. Adobe Photoshop, GIMP, Canva),
creation/modification timestamps, and detects metadata manipulation anomalies.
"""
import os
from typing import Dict, Any, Optional
from PIL import Image, ExifTags


KNOWN_EDITING_SOFTWARE = [
    "PHOTOSHOP", "GIMP", "CANVA", "PIXLR", "LIGHTROOM", "CORELDRAW",
    "ILLUSTRATOR", "AFFINITY", "PAINT.NET", "SEASHORE", "ACDSEE"
]


def extract_image_metadata(image_path_or_bytes: Any) -> Dict[str, Any]:
    """
    Extracts raw EXIF metadata and detects suspicious digital editing software traces.
    """
    metadata: Dict[str, Any] = {
        "has_exif": False,
        "software": None,
        "is_edited_by_software": False,
        "creation_date": None,
        "camera_make": None,
        "camera_model": None,
        "dimensions": None,
        "format": None,
        "anomalies": []
    }

    try:
        if isinstance(image_path_or_bytes, str) and os.path.exists(image_path_or_bytes):
            img = Image.open(image_path_or_bytes)
        elif hasattr(image_path_or_bytes, "read"):
            img = Image.open(image_path_or_bytes)
        else:
            return metadata

        metadata["format"] = img.format
        metadata["dimensions"] = {"width": img.width, "height": img.height}

        # Extract EXIF tags
        exif_raw = getattr(img, "_getexif", None)
        if callable(exif_raw):
            exif_data = exif_raw()
            if exif_data:
                metadata["has_exif"] = True
                for tag_id, value in exif_data.items():
                    tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                    
                    if tag_name == "Software":
                        metadata["software"] = str(value).strip()
                        val_upper = str(value).upper()
                        if any(sw in val_upper for sw in KNOWN_EDITING_SOFTWARE):
                            metadata["is_edited_by_software"] = True
                            metadata["anomalies"].append(f"Image was modified using photo-editing software: {value}")
                    
                    elif tag_name in ["DateTimeOriginal", "DateTime"]:
                        metadata["creation_date"] = str(value).strip()
                    elif tag_name == "Make":
                        metadata["camera_make"] = str(value).strip()
                    elif tag_name == "Model":
                        metadata["camera_model"] = str(value).strip()

    except Exception as e:
        metadata["error"] = str(e)

    return metadata
