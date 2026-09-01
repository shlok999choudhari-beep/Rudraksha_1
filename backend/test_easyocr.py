import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)

for p in [current_dir, root_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

import cv2
from backend.app.ocr.easyocr_engine import EasyOCREngine

# Look for test_passport.jpg in backend/ or root
img_path = os.path.join(current_dir, "test_passport.jpg")
if not os.path.exists(img_path):
    img_path = "test_passport.jpg"

image = cv2.imread(img_path)

if image is None:
    raise RuntimeError(f"Could not load test_passport.jpg (checked {img_path})")

ocr = EasyOCREngine()

results = ocr.read(image)

print("\n===== EASY OCR RESULTS =====")

for item in results:
    print(
        f"{item['text']!r} "
        f"confidence={item['confidence']:.3f}"
    )
