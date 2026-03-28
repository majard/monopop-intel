import re
import unicodedata
from typing import Dict, Tuple, List, Optional
from rapidfuzz import fuzz


def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    return text


def strip_noise(name: str) -> str:
    if not name:
        return ""
    text = normalize_text(name)
    text = re.sub(r'\b\d+[,.]?\d*\s*(kg|g|l|ml|un|unidade|unidades|pcs?|gr|grs?)\b', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def is_ingredient_modifier(normalized: str, term: str) -> bool:
    if not normalized or not term:
        return False
    term = normalize_text(term)
    patterns = [
        rf'\b(de|da|do|com)\s+{re.escape(term)}\b',
        rf'\b{re.escape(term)}\s+(de|da|do|com)\b',
    ]
    for pattern in patterns:
        if re.search(pattern, normalized):
            return True
    return False


def is_salient_match(normalized: str, term: str) -> bool:
    """Relaxed but still structural."""
    if not normalized or not term:
        return False
    term_norm = normalize_text(term)
    tokens = normalized.split()
    if term_norm not in [normalize_text(t) for t in tokens]:
        return False
    if is_ingredient_modifier(normalized, term):
        return False
    return True


def extract_package_size_and_unit(name: str) -> Tuple[Optional[float], Optional[str]]:
    if not name:
        return None, None
    patterns = [
        r'(\d+[,.]?\d*)\s*(kg)', r'(\d+[,.]?\d*)\s*(g)\b',
        r'(\d+[,.]?\d*)\s*(l)\b', r'(\d+[,.]?\d*)\s*(ml)',
        r'(\d+[,.]?\d*)\s*(un|unidade|unidades|gr|grs?)',
    ]
    for pattern in patterns:
        match = re.search(pattern, name.lower())
        if match:
            try:
                value = float(match.group(1).replace(',', '.'))
                unit_raw = match.group(2)
                if unit_raw in ['kg']: return value * 1000, 'g'
                if unit_raw in ['l']: return value * 1000, 'ml'
                if unit_raw in ['un', 'unidade', 'unidades']: return value, 'un'
                if unit_raw in ['gr', 'grs']: return value, 'g'
                return value, unit_raw
            except ValueError:
                continue
    return None, None


def extract_brand(name: str) -> Optional[str]:
    if not name:
        return None
    text = normalize_text(name)
    tokens = text.split()
    stopwords = {"de", "da", "do", "com", "integral", "parboilizado", "tipo", "light", "kg", "g", "ml", "l", "un"}
    for token in reversed(tokens):
        if token not in stopwords and len(token) > 2:
            return token.title()
    return None


def clean_and_classify(
    name: str,
    term: str,
    allow_list_terms: List[str]
) -> Dict:
    if not name or not term:
        return {"generic_name": None, "normalized_name": "", "fuzzy_score": 0.0,
                "parsed_brand": None, "package_size": None, "unit": None,
                "is_noise": True, "confidence_flags": {}}
    
    normalized = strip_noise(name)
    package_size, unit = extract_package_size_and_unit(name)
    parsed_brand = extract_brand(name)
    
    generic_name = None
    salient = False
    term_norm = normalize_text(term)
    
    # Specific-first classification
    for candidate in allow_list_terms:
        if is_salient_match(normalized, candidate):
            salient = True
            if compute_fuzzy_score(normalized, candidate) >= 60:
                generic_name = candidate
                break
    
    is_noise = generic_name is None or not salient or is_ingredient_modifier(normalized, term_norm)
    
    return {
        "generic_name": generic_name,
        "normalized_name": normalized,
        "fuzzy_score": compute_fuzzy_score(normalized, term),
        "parsed_brand": parsed_brand,
        "package_size": package_size,
        "unit": unit,
        "is_noise": is_noise,
        "confidence_flags": {
            "has_size": package_size is not None,
            "good_fuzzy": compute_fuzzy_score(normalized, term) >= 85,
            "salient_match": salient
        }
    }


def compute_fuzzy_score(normalized: str, term: str) -> float:
    if not normalized or not term:
        return 0.0
    return fuzz.token_set_ratio(normalize_text(normalized), normalize_text(term))