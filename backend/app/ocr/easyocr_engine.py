import easyocr
import numpy as np


class EasyOCREngine:
    def __init__(self):
        self.reader = easyocr.Reader(
            ["en"],
            gpu=False,
            verbose=False
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

        results = self.reader.readtext(image)

        output = []

        for bbox, text, confidence in results:
            output.append({
                "bbox": bbox,
                "text": text,
                "confidence": float(confidence)
            })

        return output
