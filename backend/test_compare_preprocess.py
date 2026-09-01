import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)

for p in [current_dir, root_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

import cv2
from backend.app.ocr.easyocr_engine import EasyOCREngine
from backend.app.ocr.preprocess import preprocess_for_ocr

img_path = os.path.join(current_dir, "test_passport.jpg")
image = cv2.imread(img_path)

if image is None:
    raise RuntimeError(f"Could not load test_passport.jpg from {img_path}")

ocr = EasyOCREngine()

# 1. Original image
print("\n==========================================")
print("=== 1. ORIGINAL IMAGE -> EASYOCR ===")
print("==========================================")
results_orig = ocr.read(image)
for item in results_orig:
    print(f"{item['text']!r} (conf={item['confidence']:.3f})")

# 2. Preprocessed image
print("\n==========================================")
print("=== 2. PREPROCESSED IMAGE -> EASYOCR ===")
print("==========================================")
preprocessed = preprocess_for_ocr(image)
results_prep = ocr.read(preprocessed)
for item in results_prep:
    print(f"{item['text']!r} (conf={item['confidence']:.3f})")
