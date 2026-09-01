import re
from typing import List, Tuple, Dict, Any


def clean_mrz_fragment(text: str) -> str:
    """
    Cleans raw OCR output by removing whitespace only.
    Preserves all characters (including |, /, <) for structural analysis.
    """
    if not text:
        return ""
    text = text.upper()
    # Remove whitespace only
    return re.sub(r"\s+", "", text)


def reconstruct_mrz_from_detections(results: List[Dict[str, Any]]) -> Tuple[str, str]:
    """
    Groups raw EasyOCR bounding box detections into 2 sorted horizontal MRZ rows.
    Returns:
        (raw_line1, raw_line2)
    """
    fragments = []

    for item in results:
        bbox = item["bbox"]
        text = item["text"]
        conf = item["confidence"]

        cleaned = clean_mrz_fragment(text)
        if not cleaned:
            continue

        xs = [p[0] for p in bbox]
        ys = [p[1] for p in bbox]

        x_center = sum(xs) / len(xs)
        y_center = sum(ys) / len(ys)

        fragments.append({
            "text": cleaned,
            "x": x_center,
            "y": y_center,
            "confidence": conf
        })

    if not fragments:
        return "", ""

    # Sort vertically by Y center
    fragments.sort(key=lambda f: f["y"])

    if len(fragments) == 1:
        return fragments[0]["text"], ""

    # Split into two rows using Y median
    ys = [f["y"] for f in fragments]
    median_y = (min(ys) + max(ys)) / 2.0

    line1 = []
    line2 = []

    for fragment in fragments:
        if fragment["y"] < median_y:
            line1.append(fragment)
        else:
            line2.append(fragment)

    # Sort each line left-to-right by X center
    line1.sort(key=lambda f: f["x"])
    line2.sort(key=lambda f: f["x"])

    raw_line1 = "".join(f["text"] for f in line1)
    raw_line2 = "".join(f["text"] for f in line2)

    return raw_line1, raw_line2


def normalize_mrz_td3(raw_line1: str, raw_line2: str) -> Tuple[str, str]:
    """
    Normalizes raw reconstructed MRZ lines using ICAO Doc 9303 TD3 grammar rules:
    - Line 1: P<CCC[SURNAME]<<[GIVEN_NAMES]<<<<<<<
    - Line 2: [DOC_NO][CHK][NAT][DOB][CHK][SEX][EXP][CHK][OPT][CHK][COMP]
    """
    # -------------------------------------------------------------
    # 1. Normalize Line 1 (Document Type, Country, Names)
    # -------------------------------------------------------------
    l1 = raw_line1
    # Replace stray OCR punctuation in fillers
    l1 = l1.replace("/", "<").replace("\\", "<").replace("(", "<").replace(")", "<")
    l1 = l1.replace("[", "<").replace("]", "<").replace("{", "<").replace("}", "<")

    # Fix document header "P<" or "P<<"
    if l1.startswith("P<"):
        pass
    elif l1.startswith("P"):
        l1 = "P<" + l1[1:]
    else:
        l1 = "P<" + l1

    # Remove extra '<' after P if P<< was created
    if l1.startswith("P<<"):
        l1 = "P<" + l1[3:]

    # Country code is at positions 2..5 (3 chars: e.g. IND)
    # In this alpha region, '|' or '1' or 'L' is the letter 'I'
    prefix = l1[:2]  # "P<"
    rest = l1[2:]

    # Fix country code characters in the first 3 alpha positions
    if len(rest) >= 3:
        country_chars = list(rest[:3])
        for idx in range(len(country_chars)):
            if country_chars[idx] in ["|", "1", "L", "!"]:
                country_chars[idx] = "I"
            elif country_chars[idx] == "0":
                country_chars[idx] = "O"
            elif country_chars[idx] == "<":
                # Filler in country position is rare, check next char
                pass
        country = "".join(country_chars)
        name_part = rest[3:]
    else:
        country = rest.replace("|", "I")
        name_part = ""

    # Fix name region: ensure surname and given names are separated by '<<'
    # Clean non-MRZ characters from name part
    name_part = re.sub(r"[^A-Z0-9<]", "", name_part)

    # In TD3 Line 1, the name tokens are SURNAME followed by GIVEN NAMES
    # Split on '<' to extract the actual words
    name_tokens = [t for t in name_part.split("<") if t]
    if len(name_tokens) >= 2:
        surname_str = name_tokens[0]
        given_str = "<".join(name_tokens[1:])
        name_part = f"{surname_str}<<{given_str}"
    elif len(name_tokens) == 1:
        name_part = name_tokens[0]

    norm_line1 = f"{prefix}{country}{name_part}".ljust(44, "<")[:44]

    # -------------------------------------------------------------
    # 2. Normalize Line 2 (Document Number, Dates, Checksums)
    # -------------------------------------------------------------
    l2 = raw_line2
    l2 = l2.replace("/", "<").replace("\\", "<").replace("(", "<").replace(")", "<")
    l2 = l2.replace("[", "<").replace("]", "<").replace("{", "<").replace("}", "<")
    l2 = re.sub(r"[^A-Z0-9<]", "", l2)

    # If position 10..12 (Nationality) has '<' or '|' as first char matching country
    if len(l2) >= 13:
        doc_part = l2[:10]  # Doc (9) + Check (1)
        nat_chars = list(l2[10:13])
        if nat_chars[0] in ["<", "|", "1"] and len(country) == 3:
            nat_chars[0] = country[0]  # e.g. 'I' from IND
        nat_part = "".join(nat_chars)
        rest_l2 = l2[13:]
        l2 = f"{doc_part}{nat_part}{rest_l2}"

    norm_line2 = l2.ljust(44, "<")[:44]

    return norm_line1, norm_line2

