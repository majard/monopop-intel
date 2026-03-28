# parsers/product_normalizer.py

import re
import unicodedata
from typing import List, Dict, Optional
from rapidfuzz import fuzz


# -------------------------
# BASIC NORMALIZATION
# -------------------------


def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def strip_noise(text: str) -> str:
    text = normalize_text(text)

    noise_tokens = {"oferta", "promo", "leve", "pague", "gratis", "novo", "tradicional"}

    tokens = [t for t in text.split() if t not in noise_tokens]
    return " ".join(tokens)


# -------------------------
# FUZZY
# -------------------------


def compute_fuzzy_score(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return fuzz.token_set_ratio(a, b)


# -------------------------
# MATCHING LOGIC
# -------------------------


def is_salient_match(product: str, term: str) -> bool:
    """
    Strong "generic at the beginning" rule + support for multi-word terms.
    """
    if not product or not term:
        return False

    product_norm = normalize_text(product)
    term_norm = normalize_text(term)

    # Strong beginning rule: term should be among the first 3 tokens
    tokens = product_norm.split()
    term_tokens = term_norm.split()

    # For single-word terms: must be in first 2 tokens
    if len(term_tokens) == 1:
        return term_norm in tokens[:2]

    # For multi-word terms: allow if it appears as a phrase early
    term_phrase = " ".join(term_tokens)
    return term_phrase in " ".join(tokens[:5])


def is_ingredient_modifier(product: str, term: str) -> bool:
    """
    Only flag as modifier if the term appears AFTER 'de/da/do/com' 
    or is clearly a flavor/secondary component.
    Do NOT flag "Esponja de Limpeza..." as modifier — "esponja" is the main product.
    """
    if not term:
        return False

    term_norm = normalize_text(term)
    product_norm = normalize_text(product)

    # Strong modifier patterns: term is secondary
    if re.search(rf'\b(de|da|do|com)\s+{re.escape(term_norm)}\b', product_norm):
        return True

    # Also catch " [term] de X " where term is flavor/ingredient
    if re.search(rf'\b{re.escape(term_norm)}\s+(de|da|do|com)\b', product_norm):
        return True

    return False

# -------------------------
# PACKAGE EXTRACTION
# -------------------------


def extract_package_size_and_unit(name: str):
    if not name:
        return None, None

    text = normalize_text(name)

    match = re.search(r"(\d+(?:[.,]\d+)?)\s?(kg|g|mg|l|ml|un)", text)
    if match:
        size = match.group(1).replace(",", ".")
        unit = match.group(2)
        return float(size), unit

    return None, None


# -------------------------
# BRAND EXTRACTION
# -------------------------


def extract_brand(name: str, generic_name: Optional[str]) -> Optional[str]:
    """Brand usually comes right after the generic term."""
    if not name:
        return None

    text = normalize_text(name)
    tokens = text.split()

    stopwords = {
        "de",
        "da",
        "do",
        "com",
        "integral",
        "parboilizado",
        "tipo",
        "light",
        "kg",
        "g",
        "ml",
        "l",
        "un",
        "fatiado",
        "congelado",
        "resfriado",
        "refil",
        "litros",
        "pacote",
        "caixa",
        "economico",
        "lavanda",
        "cuidado",
        "primavera",
        "delicadas",
        "bebe",
        "odor",
        "maciez",
        "sabor",
        "creme",
        "recheio",
        "cobertura",
        "calda",
        "grelhado",
    }

    if generic_name:
        generic_tokens = set(normalize_text(generic_name).split())
    else:
        generic_tokens = set()

    # Look for brand right after generic (your hint)
    for i, token in enumerate(tokens):
        if token in generic_tokens and i + 1 < len(tokens):
            next_token = tokens[i + 1]
            if (
                next_token not in stopwords
                and len(next_token) > 2
                and not next_token.replace(".", "", 1).isdigit()
            ):
                return next_token.title()

    # Fallback: last meaningful token
    for token in reversed(tokens):
        if (
            token not in stopwords
            and token not in generic_tokens
            and len(token) > 2
            and not token.replace(".", "", 1).isdigit()
        ):
            return token.title()

    return None


# -------------------------
# CORE CLASSIFIER
# -------------------------


def clean_and_classify(name: str, term: str, allow_list_terms: List[str]) -> Dict:

    if not name or not term:
        return {
            "generic_name": None,
            "normalized_name": "",
            "fuzzy_score": 0.0,
            "parsed_brand": None,
            "package_size": None,
            "unit": None,
            "is_noise": True,
            "confidence_flags": {},
        }

    normalized = strip_noise(name)
    term_norm = normalize_text(term)

    package_size, unit = extract_package_size_and_unit(name)

    best_candidate = None
    best_score = 0
    best_length = 0

    # Hybrid ranking with preference for early appearance
    for candidate in allow_list_terms:
        candidate_norm = normalize_text(candidate)

        if not is_salient_match(normalized, candidate_norm):
            continue

        score = compute_fuzzy_score(normalized, candidate_norm)

        if score < 60:
            continue

        # Prioritize terms that appear early
        if candidate_norm.split()[0] in normalized.split()[:4] or score > best_score:
            best_candidate = candidate
            best_score = score
            best_length = len(candidate_norm)

    generic_name = best_candidate

    # Extract brand after finding generic name
    parsed_brand = extract_brand(name, generic_name)

    is_noise = generic_name is None or is_ingredient_modifier(normalized, term_norm)

    return {
        "generic_name": generic_name,
        "normalized_name": normalized,
        "fuzzy_score": best_score,
        "parsed_brand": parsed_brand,
        "package_size": package_size,
        "unit": unit,
        "is_noise": is_noise,
        "confidence_flags": {
            "has_size": package_size is not None,
            "good_fuzzy": best_score >= 85,
            "salient_match": best_candidate is not None,
        },
    }
