# tests/conftest.py
import sys
from pathlib import Path
import pytest
import json

# Add the api root to Python path so 'parsers' can be imported
sys.path.insert(0, str(Path(__file__).parent.parent))

@pytest.fixture(scope="session")
def allow_list_terms():
    """Load the real allow_list from production (order matters)."""
    path = Path(__file__).resolve().parent.parent / "allow_list.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return [item["term"] for item in data.get("terms", [])]