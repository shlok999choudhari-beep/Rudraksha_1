import re
from typing import List, Dict, Optional, Any
from pydantic import BaseModel


class VIZFieldResult(BaseModel):
    document_number: str = ""
    surname: str = ""
    given_names: str = ""
    full_name: str = ""
    nationality: str = ""
    date_of_birth: str = ""
    date_of_expiry: str = ""
    sex: str = ""
    raw_fields: Dict[str, Any] = {}


# All known label tokens across international travel documents
ALL_KNOWN_LABELS = [
    "PASSPORT NO", "NO DU PASSEPORT", "PASSEPORT NO", "DOC NO", "DOCUMENT NO", "PASSPORT NUMBER",
    "SURNAME", "NOM", "APELLIDOS", "FAMILY NAME",
    "GIVEN NAMES", "PRENOMS", "GIVEN NAME", "NOMBRES", "FORENAMES",
    "NATIONALITY", "NATIONALITE", "NACIONALIDAD",
    "DATE OF BIRTH", "DATE DE NAISSANCE", "FECHA DE NACIMIENTO", "BIRTH",
    "SEX", "SEXE", "SEXO", "SEX / SEXE",
    "DATE OF ISSUE", "DATE DE DELIVRANCE",
    "DATE OF EXPIRY", "DATE DEXPIRATION", "DATE D'EXPIRATION", "EXPIRATION", "EXPIRY", "FECHA DE CADUCIDAD",
    "TYPE", "COUNTRY CODE", "PAYS", "REPUBLIC", "SPECIMEN"
]


def is_label_token(text: str) -> bool:
    """Returns True if the text represents an ID document field label or header."""
    t_clean = re.sub(r"[^A-Z ]", "", text.upper()).strip()
    if not t_clean or len(t_clean) < 2:
        return False
    return any(lbl == t_clean or (len(t_clean) > 3 and (t_clean in lbl or lbl in t_clean)) for lbl in ALL_KNOWN_LABELS)


# Standard label anchors used to locate field values
PRIMARY_LABEL_ANCHORS = {
    "document_number": ["PASSPORT NO", "PASSEPORT NO", "DOC NO", "DOCUMENT NO", "PASSPORT NUMBER"],
    "surname": ["SURNAME", "NOM", "APELLIDOS", "FAMILY NAME"],
    "given_names": ["GIVEN NAMES", "PRENOMS", "GIVEN NAME", "NOMBRES", "FORENAMES"],
    "nationality": ["NATIONALITY", "NATIONALITE", "NACIONALIDAD"],
    "date_of_birth": ["DATE OF BIRTH", "DATE DE NAISSANCE", "FECHA DE NACIMIENTO", "BIRTH"],
    "sex": ["SEX", "SEXE", "SEXO", "SEX / SEXE"],
    "date_of_expiry": ["DATE OF EXPIRY", "DATE D'EXPIRATION", "EXPIRATION", "EXPIRY", "FECHA DE CADUCIDAD"]
}


def extract_viz_fields_from_ocr(
    results: List[Dict[str, Any]],
    image_shape: tuple
) -> VIZFieldResult:
    """
    Extracts VIZ fields using 2D spatial layout relationships between label anchors and value boxes.
    """
    h, w = image_shape[:2]
    mrz_y_boundary = int(h * 0.70)

    # 1. Normalize boxes into spatial representation
    boxes = []
    for item in results:
        t = item["text"].strip()
        if not t:
            continue

        pts = item["bbox"]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]

        bx = int(min(xs))
        by = int(min(ys))
        bw = int(max(xs) - bx)
        bh = int(max(ys) - by)

        # Exclude bottom MRZ band from VIZ parsing
        if by >= mrz_y_boundary:
            continue

        boxes.append({
            "text": t,
            "bx": bx,
            "by": by,
            "bw": bw,
            "bh": bh,
            "cx": bx + bw / 2.0,
            "cy": by + bh / 2.0,
            "conf": item.get("confidence", 1.0),
            "is_label": is_label_token(t)
        })

    # 2. Identify primary label anchors
    label_boxes = {}
    for field_key, keywords in PRIMARY_LABEL_ANCHORS.items():
        best_match = None
        best_score = 0

        for b in boxes:
            b_text_upper = b["text"].upper()
            for kw in keywords:
                if kw in b_text_upper:
                    score = len(kw) / float(len(b_text_upper) + 1)
                    if score > best_score:
                        best_score = score
                        best_match = b

        if best_match:
            label_boxes[field_key] = best_match

    # 3. For each label, find the nearest value box directly beneath it in the same column
    extracted = {}

    for field_key, lbl_box in label_boxes.items():
        lx = lbl_box["bx"]
        ly = lbl_box["by"]
        lw = lbl_box["bw"]
        lh = lbl_box["bh"]

        candidates = []

        for b in boxes:
            # Skip any box that is identified as a label
            if b["is_label"]:
                continue

            # Value box is beneath or immediately following label header (dy between -10px and 45px)
            dy = b["by"] - (ly + lh)
            # Column horizontal offset from left edge of label
            dx = abs(b["bx"] - lx)

            if -10 <= dy <= 45 and dx <= 60:
                # Prioritize directly underneath with minimum horizontal delta
                score = abs(dy) + dx * 2.0
                candidates.append((score, b["text"], b))

        if candidates:
            candidates.sort(key=lambda c: c[0])
            val_text = candidates[0][1].strip()
            val_text = re.sub(r"^[:;/\-_.]+\s*", "", val_text)
            extracted[field_key] = val_text

    # Synthesize Full Name
    sname = extracted.get("surname", "")
    gname = extracted.get("given_names", "")
    fname = f"{gname} {sname}".strip() if (gname or sname) else ""

    return VIZFieldResult(
        document_number=extracted.get("document_number", ""),
        surname=sname,
        given_names=gname,
        full_name=fname,
        nationality=extracted.get("nationality", ""),
        date_of_birth=extracted.get("date_of_birth", ""),
        date_of_expiry=extracted.get("date_of_expiry", ""),
        sex=extracted.get("sex", ""),
        raw_fields=extracted
    )
