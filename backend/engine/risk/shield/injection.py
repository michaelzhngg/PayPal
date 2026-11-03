import re
import unicodedata

from engine.risk.types import RiskSignal, Severity, SignalCode, make_signal

_FLAGS = re.IGNORECASE | re.MULTILINE | re.DOTALL

PATTERNS = [
    re.compile(p, _FLAGS)
    for p in (
        r"\bignore\b.{0,40}\b(previous|prior|above|all)\b.{0,20}\b(instruction|prompt|rule)s?",
        r"^\s*(system|assistant|developer)\s*[:>]",
        r"</?\s*(system|instructions?|prompt|receipt_data|untrusted\w*)[^>]*>",
        r"\b(auto-?)?approve\b.{0,30}\b(this|the)\s+(claim|reimbursement)",
        # The trailing \b keeps "confidence 15" or "Room 10" from matching the 1.
        r"\bconfidence\b.{0,15}\b(1(\.0+)?\b|100\s?%)",
        r"\byou are now\b",
        r"\bact as (an?|the)\b",
        r"\bdisregard\b.{0,40}\b(instruction|policy|rule)s?",
        r"\babaikan\b.{0,40}\barahan\b",
    )
]

# Zero-width characters and soft hyphens let "IG​NORE" slip past a regex.
_INVISIBLE = dict.fromkeys(map(ord, "­​‌‍⁠﻿"))

MAX_SNIPPETS = 3
MAX_SNIPPET_LEN = 80


def _normalise(text: str) -> str:
    # NFKC folds full-width letters to ASCII.
    return unicodedata.normalize("NFKC", text).translate(_INVISIBLE)


def scan_text(text: str, document_id: str | None = None) -> RiskSignal | None:
    if not text:
        return None
    clean = _normalise(text)
    snippets: list[str] = []
    for pattern in PATTERNS:
        for match in pattern.finditer(clean):
            snippet = " ".join(match.group(0).split())[:MAX_SNIPPET_LEN]
            if snippet and snippet not in snippets:
                snippets.append(snippet)
            if len(snippets) == MAX_SNIPPETS:
                break
        if len(snippets) == MAX_SNIPPETS:
            break
    if not snippets:
        return None
    return make_signal(
        SignalCode.PROMPT_INJECTION,
        Severity.HIGH,
        "Receipt text contains instructions aimed at the AI reviewer. Two people need to check the original.",
        {"matches": snippets},
        document_id,
    )
