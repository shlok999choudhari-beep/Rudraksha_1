import os
import gc
import numpy as np

# Limit CPU threads to prevent memory fragmentation and thread oversubscription in cloud containers
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["TORCH_NUM_THREADS"] = "1"

import easyocr

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
MODEL_STORAGE_DIR = os.path.join(BASE_DIR, "models", "easyocr")
os.makedirs(MODEL_STORAGE_DIR, exist_ok=True)


class EasyOCREngine:
    def __init__(self):
        self.reader = easyocr.Reader(
            ["en"],
            gpu=False,
            verbose=False,
            quantize=False,
            model_storage_directory=MODEL_STORAGE_DIR,
            download_enabled=False
        )

    def read(self, image):
        """
        image: OpenCV BGR image

        returns:
            [
                {
                    "bbox": ...,
                    "text": "...",
                    "confidence": ...
                }
            ]
        """
        results = self.reader.readtext(
            image,
            detail=1,
            paragraph=False,
            batch_size=1
        )

        output = []
        for bbox, text, confidence in results:
            output.append({
                "bbox": bbox,
                "text": text,
                "confidence": float(confidence)
            })

        gc.collect()
        return output

