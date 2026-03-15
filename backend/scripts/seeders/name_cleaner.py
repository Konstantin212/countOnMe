"""USDA food name normalization.

Transforms verbose USDA descriptions like
  "Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised"
into consumer-friendly names like
  "Chicken breast, braised"
"""

from __future__ import annotations

import re

_MAX_LENGTH = 60

# Segments that match any of these patterns are removed.
_NOISE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^raw$", re.IGNORECASE),
    re.compile(r"^cooked$", re.IGNORECASE),
    re.compile(r"^separable lean only$", re.IGNORECASE),
    re.compile(r"^boneless$", re.IGNORECASE),
    re.compile(r"^skinless$", re.IGNORECASE),
    re.compile(r"^trimmed to .+", re.IGNORECASE),
    re.compile(r"^select$", re.IGNORECASE),
    re.compile(r"^choice$", re.IGNORECASE),
    re.compile(r"^all grades$", re.IGNORECASE),
    re.compile(r"^year round average$", re.IGNORECASE),
    re.compile(r"^with skin$", re.IGNORECASE),
    re.compile(r"^without skin$", re.IGNORECASE),
    re.compile(r"^meat only$", re.IGNORECASE),
    re.compile(r"^meat and skin$", re.IGNORECASE),
    re.compile(r"^commercial$", re.IGNORECASE),
    re.compile(r"^regular pack$", re.IGNORECASE),
    re.compile(r"^drained solids$", re.IGNORECASE),
    re.compile(r"^broiler or fryers$", re.IGNORECASE),
    re.compile(r"^loin$", re.IGNORECASE),
]

_COOKING_METHODS: frozenset[str] = frozenset({
    "roasted",
    "baked",
    "grilled",
    "fried",
    "boiled",
    "steamed",
    "braised",
    "broiled",
    "sauteed",
    "poached",
    "smoked",
    "dried",
    "canned",
    "frozen",
})

# Category prefixes that trigger special rearrangement rules.
_CATEGORY_PREFIXES: frozenset[str] = frozenset({
    "nuts",
    "beans",
    "tomatoes",
})

_SALT_PATTERN = re.compile(r"^with salt added$", re.IGNORECASE)

# Compound preparation phrases that contain a cooking method word but should
# be preserved as qualifiers (not stripped as cooking methods).
_COMPOUND_PREPARATIONS: frozenset[str] = frozenset({
    "dry roasted",
    "deep fried",
    "stir fried",
    "pan fried",
    "oven roasted",
    "slow roasted",
    "fire roasted",
    "flash frozen",
    "freeze dried",
    "sun dried",
    "air dried",
    "hot smoked",
    "cold smoked",
})


def _is_noise(segment: str) -> bool:
    """Return True if the segment should be dropped."""
    return any(p.match(segment) for p in _NOISE_PATTERNS)


def _is_cooking_method(segment: str) -> bool:
    """Return True if the segment is exactly a recognized cooking method."""
    return segment.strip().lower() in _COOKING_METHODS


def _is_cooking_related(segment: str) -> bool:
    """Return True if the segment contains a cooking method word.

    Returns False for recognized compound preparations like "dry roasted".
    """
    seg_lower = segment.strip().lower()
    if seg_lower in _COMPOUND_PREPARATIONS:
        return False
    words = seg_lower.split()
    return bool(set(words) & _COOKING_METHODS)


def _handle_category_prefix(
    category: str,
    remaining: list[str],
) -> list[str]:
    """Rearrange segments for special category prefixes.

    - "Nuts, almonds, ..." -> ["Almonds", ...]
    - "Beans, snap, green, ..." -> ["Green snap beans", ...]
    - "Tomatoes, grape, ..." -> ["Grape tomatoes", ...]
    """
    cat_lower = category.lower()

    if cat_lower == "nuts" and remaining:
        return [remaining[0].capitalize(), *remaining[1:]]

    if cat_lower == "beans" and len(remaining) >= 2:
        qualifier = remaining[0].lower()   # "snap"
        sub_type = remaining[1].lower()    # "green"
        combined = f"{sub_type.capitalize()} {qualifier} beans"
        return [combined, *remaining[2:]]

    if cat_lower == "tomatoes" and remaining:
        qualifier = remaining[0].lower()
        combined = f"{qualifier.capitalize()} tomatoes"
        return [combined, *remaining[1:]]

    return [category, *remaining]


def clean_usda_name(raw: str) -> str:
    """Clean a USDA food description into a consumer-friendly display name.

    Steps:
      1. Split on ", " into segments
      2. Handle special category prefixes (Nuts, Beans, Tomatoes)
      3. Find first cooking method (exact segment match only)
      4. Drop noise, cooking-method, and salt-pattern segments
      5. Build primary name by merging first segment with adjacent sub-parts
      6. Append remaining qualifiers comma-separated
      7. Append cooking method
      8. Cap at 60 chars, strip trailing punctuation
    """
    if not raw or not raw.strip():
        return ""

    segments = [s.strip() for s in raw.split(", ")]
    segments = [s for s in segments if s]

    if not segments:
        return ""

    first = segments[0]
    rest = segments[1:]

    # Handle special category prefixes
    if first.lower() in _CATEGORY_PREFIXES and rest:
        pieces = _handle_category_prefix(first, rest)
    else:
        pieces = [first, *rest]

    # Find first cooking method — only exact segment matches count.
    # This avoids extracting "roasted" from "dry roasted".
    cooking_method: str | None = None
    for seg in pieces:
        if _is_cooking_method(seg):
            cooking_method = seg.strip().lower()
            break

    # Filter segments: drop noise, cooking methods (exact and embedded), salt patterns
    meaningful: list[str] = []
    for seg in pieces:
        if _is_noise(seg):
            continue
        if _is_cooking_method(seg):
            continue
        if _is_cooking_related(seg):
            continue
        if _SALT_PATTERN.match(seg):
            meaningful.append("salted")
            continue
        meaningful.append(seg)

    if not meaningful:
        return segments[0].strip().title() if segments else ""

    # Build the primary name: merge the first segment with immediately
    # following food sub-parts (e.g., "Beef" + "tenderloin roast").
    # A sub-part is a segment that describes the food item itself, not a
    # preparation qualifier. Heuristic: it does NOT contain any cooking
    # method word and is not "salted".
    primary_parts = [meaningful[0]]
    qualifier_start = 1

    for i in range(1, len(meaningful)):
        seg = meaningful[i]
        seg_lower = seg.strip().lower()
        # Stop merging at qualifiers: things that are clearly preparation
        # descriptors (contain cooking method words, or are "salted")
        words = set(seg_lower.split())
        if words & _COOKING_METHODS or seg_lower == "salted":
            qualifier_start = i
            break
        # Also stop if this looks like a preparation qualifier with a
        # modifier (e.g., "dry roasted" — but this is caught above since
        # "roasted" is in _COOKING_METHODS)
        primary_parts.append(seg)
        qualifier_start = i + 1

    primary_name = " ".join(primary_parts)
    qualifiers = meaningful[qualifier_start:]

    # Build result
    parts = [primary_name, *qualifiers]
    result = ", ".join(parts)

    # Append cooking method
    if cooking_method:
        result = f"{result}, {cooking_method}"

    # Capitalize first letter
    result = result[0].upper() + result[1:] if result else ""

    # Cap at 60 chars
    if len(result) > _MAX_LENGTH:
        result = result[:_MAX_LENGTH].rstrip(", ")

    # Strip trailing punctuation and whitespace
    result = result.rstrip(" ,;")

    return result
