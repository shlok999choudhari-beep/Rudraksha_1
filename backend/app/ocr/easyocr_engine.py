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

try:
    import torch
    torch.set_num_threads(1)
    torch.set_grad_enabled(False)
except Exception:
    pass

import easyocr


class EasyOCREngine:
    def __init__(self):
        self.reader = easyocr.Reader(
            ["en"],
            gpu=False,
            verbose=False,
            quantize=False
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

