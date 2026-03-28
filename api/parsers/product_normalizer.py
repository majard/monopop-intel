# parsers/product_normalizer.py

import re
import unicodedata
from typing import List, Dict, Optional
from rapidfuzz import fuzz
import json
from pathlib import Path

# Load brands once at module import
_KNOWN_BRANDS = None


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

    # Expanded with safe terms observed in dry-run (flavor, promo, etc.)
    noise_tokens = {
        "oferta", "promo", "leve", "pague", "gratis", "novo", "tradicional",
        "gelado", "sabor", "tipo", "integral", "parboilizado", "light", "diet",
        "zero", "com", "para", "de", "p/", "c/", "refil"
    }

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
    

    tokens = product_norm.split()
    term_tokens = term_norm.split()

    # Single-word terms: must be among the first 2 tokens
    if len(term_tokens) == 1:
        return term_norm in tokens[:2]

    # Multi-word: allow common connectors (para, p/, de, com) between parts
    term_phrase = " ".join(term_tokens)
    product_joined = " ".join(tokens)

    # Strong early check (first 6 tokens)
    if term_phrase in " ".join(tokens[:6]):   # slightly more room, still early
        return True

    # Safe connector-aware check: allow "X para Y" / "X p/ Y" / "X de Y" if X and Y parts appear reasonably early
    connectors = {"para", "p/", "de", "com", "com "}
    for conn in connectors:
        variant = term_norm.replace(" ", f" {conn} ")
        if variant in product_joined and any(t in tokens[:7] for t in term_tokens):
            return True

    return False


def is_ingredient_modifier(product: str, term: str) -> bool:
    """
    Distinguish between:
    - "X de TERM" where TERM is ingredient (Steak de Frango)
    - "TERM de X" where TERM is the product (Esponja de Limpeza)
    """
    term_norm = normalize_text(term)
    product_norm = normalize_text(product)
    tokens = product_norm.split()

    # Find term position
    term_positions = [
        i for i, t in enumerate(tokens) if t == term_norm or term_norm in t
    ]

    for pos in term_positions:
        # Check if preceded by "de/da/do/com" (term is likely ingredient)
        if pos > 0 and tokens[pos - 1] in {"de", "da", "do", "com"}:
            # BUT: if term is in first 3 tokens, it's likely the product itself
            # "Esponja de Limpeza" - esponja is at 0, so NOT a modifier
            if pos <= 2:
                return False
            return True

        # Check if followed by "de" (term is likely the main product)
        if pos < len(tokens) - 1 and tokens[pos + 1] in {"de", "da", "do"}:
            return False

    return False


# -------------------------
# PACKAGE EXTRACTION
# -------------------------


def extract_package_size_and_unit(name: str):
    if not name:
        return None, None

    text = normalize_text(name)

    patterns = [
        # Compound: "4 x 100g", "c/ 6 x 50g", "pack com 6 unid de 100g"
        # Retorna o tamanho da unidade individual, não o total
        r"(?:c/|com|pack\s+com?)?\s*\d+\s*(?:x|un|unid|unidades?)\s*(?:de\s+)?(\d+[.,]?\d*)\s*(kg|g|mg|l|ml)",
        
        # Padrão principal: número + unidade
        r"(\d+[.,]?\d*)\s*(kg|g|mg|l|ml|un|unid|unidade|litro|litros)",
        
        # Metros: "30cm x 7,5m", "4m x 30cm" — captura o comprimento (m)
        r"(\d+[.,]?\d*)\s*(m)\b(?!\s*[lg])",  # evita "ml"
        
        # Contagem simples: "c/10", "c/ 50 unid"
        r"c/\s*(\d+)\s*(unid|un|unidades?)?",
    ]

    for pattern in patterns:
        matches = list(re.finditer(pattern, text, re.IGNORECASE))
        if not matches:
            continue
        
        match = matches[-1]  # último match = tamanho real
        groups = [g for g in match.groups() if g is not None]
        
        if len(groups) < 1:
            continue
            
        size_str = groups[0].replace(",", ".")
        unit_raw = groups[1].lower() if len(groups) > 1 and groups[1] else "un"

        try:
            size = float(size_str)
            
            # Normalizar unidades
            if unit_raw in {"un", "unid", "unidade", "unidades"}:
                unit = "un"
            elif unit_raw in {"litro", "litros"}:
                unit, size = "ml", size * 1000
            elif unit_raw == "kg":
                unit, size = "g", size * 1000
            elif unit_raw == "l":
                unit, size = "ml", size * 1000
            elif unit_raw == "m":
                unit = "m"  # papel alumínio, rolo — não converter
            else:
                unit = unit_raw
                
            return size, unit
        except (ValueError, TypeError):
            continue

    return None, None


# -------------------------
# BRAND EXTRACTION
# -------------------------

def _load_known_brands():
    global _KNOWN_BRANDS
    if _KNOWN_BRANDS is None:
        path = Path(__file__).parent / "brands.json"
        _KNOWN_BRANDS = set()
        if path.exists():
            with open(path, encoding="utf-8") as f:   # <-- Fixed here
                data = json.load(f)
                for b in data.get("brands", []):
                    if b.get("active", True):
                        _KNOWN_BRANDS.add(b["brand"].lower())
                        if b.get("canonical"):
                            _KNOWN_BRANDS.add(b["canonical"].lower())
    return _KNOWN_BRANDS


def extract_brand(
    name: str, generic_name: Optional[str], db_brand: Optional[str] = None
) -> Optional[str]:
    """Extract brand: DB hint -> Known brands JSON -> Positional heuristics."""

    # Priority 1: DB brand if present in name
    if db_brand:
        db_norm = normalize_text(db_brand)
        if db_norm in normalize_text(name):
            match = re.search(rf"\b({re.escape(db_brand)})\b", name, re.IGNORECASE)
            return match.group(1).title() if match else db_brand.title()

    # Priority 2: Known brands from JSON (NEW)
    known_brands = _load_known_brands()
    if known_brands:
        name_norm = normalize_text(name)
        matches = [b for b in known_brands if b in name_norm]
        matches.sort(key=len, reverse=True)  # "Pingo Doce" before "Pingo"

        for brand in matches:
            if re.search(rf"\b{re.escape(brand)}\b", name_norm):
                match = re.search(rf"\b({re.escape(brand)})\b", name, re.IGNORECASE)
                return match.group(1).title() if match else brand.title()

    # Priority 3: Positional logic - look right after generic term
    if not name:
        return None

    text = normalize_text(name)
    tokens = text.split()

    # Expanded stopwords + descriptors
    stopwords = {
        "de",
        "da",
        "do",
        "com",
        "para",
        "em",
        "e",
        "sem",
        "integral",
        "parboilizado",
        "tipo",
        "light",
        "diet",
        "zero",
        "kg",
        "g",
        "mg",
        "ml",
        "l",
        "un",
        "unidades",
        "undidades",
        "fatiado",
        "congelado",
        "resfriado",
        "refil",
        "litros",
        "pacote",
        "caixa",
        "pote",
        "economico",
        "economica",
        "lavanda",
        "cuidado",
        "primavera",
        "delicadas",
        "bebe",
        "infantil",
        "baby",
        "odor",
        "maciez",
        "sabor",
        "creme",
        "recheio",
        "cobertura",
        "calda",
        "grelhado",
        "premium",
        "natural",
        "organico",
        "organica",
        "tradicional",
        "polido",
        "branco",
        "vermelho",
        "preto",
        "pedaco",
        "pedacos",
        "unidade",
        "fatia",
        "fatias",
    }

    if generic_name:
        generic_tokens = set(normalize_text(generic_name).split())
    else:
        generic_tokens = set()

    # Look for brand right after generic (skip stopwords and other generic tokens)
    for i, token in enumerate(tokens):
        if token in generic_tokens:
            # Look ahead up to 3 positions to find brand
            for j in range(i + 1, min(i + 4, len(tokens))):
                candidate = tokens[j]
                # Skip if stopword, part of generic, too short, or has digits
                if (
                    candidate in stopwords
                    or candidate in generic_tokens
                    or len(candidate) <= 2
                    or any(c.isdigit() for c in candidate)
                ):
                    continue
                return candidate.title()
            # If we found generic but no brand after it, stop looking
            break

    # Fallback: last meaningful token (before any numbers)
    for token in reversed(tokens):
        if (
            token not in stopwords
            and token not in generic_tokens
            and len(token) > 2
            and not any(c.isdigit() for c in token)
        ):
            return token.title()

    return None


# -------------------------
# CORE CLASSIFIER
# -------------------------

def clean_and_classify(
    name: str, term: str, allow_list_terms: List[str], db_brand: Optional[str] = None
) -> Dict:

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

    # Most-specific first: longer terms preferred, but preserve original order stability
    for candidate in sorted(allow_list_terms, key=len, reverse=True):
        candidate_norm = normalize_text(candidate)

        if not is_salient_match(normalized, candidate_norm):
            continue

        score = compute_fuzzy_score(normalized, candidate_norm)

        if score < 60:
            continue

        # Prefer early appearance of the candidate or better fuzzy score
        if (candidate_norm.split()[0] in normalized.split()[:4]) or (score > best_score):
            best_candidate = candidate
            best_score = score

    generic_name = best_candidate
    parsed_brand = extract_brand(name, generic_name, db_brand)

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
