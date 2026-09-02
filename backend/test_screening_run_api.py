import requests
import json

with open("test_passport.jpg", "rb") as f:
    upload_res = requests.post("http://127.0.0.1:8000/api/documents/preprocess", files={"file": ("test_passport.jpg", f, "image/jpeg")})
    upload_data = upload_res.json()

print("Upload Response:", json.dumps(upload_data, indent=2))
doc_id = upload_data["document_id"]

screen_res = requests.post("http://127.0.0.1:8000/api/screening/run", json={"document_id": doc_id, "document_type": "PASSPORT"})
print("\nScreening HTTP Status:", screen_res.status_code)
screen_data = screen_res.json()
print("Screening Response JSON:", json.dumps(screen_data, indent=2))
