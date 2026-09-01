import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)

for p in [current_dir, root_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

import cv2
from backend.app.ocr.easyocr_engine import EasyOCREngine

img_path = os.path.join(current_dir, "test_passport.jpg")
image = cv2.imread(img_path)

if image is None:
    raise RuntimeError(f"Could not load test_passport.jpg from {img_path}")

# Manual MRZ crop (bottom 30%)
h, w = image.shape[:2]
mrz = image[int(h * 0.70):h, :]

ocr = EasyOCREngine()
results = ocr.read(mrz)

print("\n===== EASY OCR MRZ CROP RESULTS =====")
for item in results:
    print(f"{item['text']!r} confidence={item['confidence']:.3f}")
