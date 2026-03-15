"""Filter the Open Food Facts Parquet file into a flat CSV for seeding.

Two-pass strategy to avoid loading 4.4 GB of nested data:
  Pass 1: Read only 3 scalar columns (~60 MB) → C++ filter + sort → row indices
  Pass 2: Read all columns in batches, skip batches without survivors

Expected: ~2-3 min, ~1 GB RAM.

Usage (from backend/ directory):
    python -m scripts.prepare_off_data [--seeds-dir PATH] [--limit 5000]
"""

from __future__ import annotations

import argparse
import csv
import logging
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

_MARKET_TAGS: frozenset[str] = frozenset({
    "en:united-states",
    "en:united-kingdom",
    "en:canada",
    "en:australia",
    "en:france",
    "en:germany",
    "en:netherlands",
    "en:spain",
    "en:austria",
    "en:poland",
    "en:ukraine",
})

_NUTRIMENT_NAMES: dict[str, str] = {
    "energy-kcal": "energy_kcal_100g",
    "proteins": "proteins_100g",
    "carbohydrates": "carbohydrates_100g",
    "fat": "fat_100g",
}

_VALID_NUTRISCORE: frozenset[str] = frozenset({"a", "b", "c", "d", "e"})

_ALL_COLUMNS: list[str] = [
    "code",
    "product_name",
    "brands",
    "categories",
    "countries_tags",
    "nutriments",
    "completeness",
    "nutriscore_grade",
    "unique_scans_n",
    "serving_size",
]

_CSV_HEADER: list[str] = [
    "code",
    "product_name",
    "brands",
    "categories",
    "energy_kcal_100g",
    "proteins_100g",
    "carbohydrates_100g",
    "fat_100g",
    "serving_size",
    "unique_scans_n",
]


# ---------------------------------------------------------------------------
# Row-level extractors
# ---------------------------------------------------------------------------

def _extract_english_name(product_name_list: object) -> str | None:
    if not hasattr(product_name_list, "__iter__"):
        return None
    best: str | None = None
    for entry in product_name_list:
        if not isinstance(entry, dict):
            continue
        lang = entry.get("lang")
        text = entry.get("text")
        if not isinstance(text, str) or not text.strip():
            continue
        if lang == "en":
            return text.strip()
        if lang == "main" and best is None:
            best = text.strip()
    return best


def _extract_nutriments(nutriments_list: object) -> dict[str, float | None]:
    result: dict[str, float | None] = {v: None for v in _NUTRIMENT_NAMES.values()}
    if not hasattr(nutriments_list, "__iter__"):
        return result
    for entry in nutriments_list:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name")
        if name in _NUTRIMENT_NAMES:
            val = entry.get("100g")
            if val is not None:
                try:
                    result[_NUTRIMENT_NAMES[name]] = float(val)
                except (ValueError, TypeError):
                    pass
    return result


def _is_english_market(countries_tags: object) -> bool:
    if not hasattr(countries_tags, "__iter__"):
        return False
    for tag in countries_tags:
        if isinstance(tag, str) and tag.lower() in _MARKET_TAGS:
            return True
    return False


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def _run(seeds_dir: str, limit: int) -> None:
    try:
        import pyarrow as pa
        import pyarrow.compute as pc
        import pyarrow.parquet as pq
    except ImportError:
        logger.error("pyarrow is required. Install with: pip install pyarrow")
        sys.exit(1)

    parquet_path = Path(seeds_dir) / "food.parquet"
    if not parquet_path.exists():
        logger.error("Parquet file not found: %s", parquet_path)
        sys.exit(1)

    output_path = Path(seeds_dir) / "off_products_filtered.csv"
    pf = pq.ParquetFile(str(parquet_path))

    # ---- PASS 1: Read only scalar columns (~60 MB, very fast) -------------
    logger.info("Pass 1: Reading scalar columns only ...")
    scalar_cols = ["completeness", "nutriscore_grade", "unique_scans_n"]
    scalar_table = pq.read_table(str(parquet_path), columns=scalar_cols)
    total_input = len(scalar_table)
    logger.info("Total rows: %d", total_input)

    # C++ filter: completeness >= 0.65
    comp = scalar_table.column("completeness")
    mask = pc.and_(pc.is_valid(comp), pc.greater_equal(comp, 0.65))

    # C++ filter: nutriscore_grade in {a..e}
    grade_raw = scalar_table.column("nutriscore_grade")
    grade_str = pc.if_else(pc.is_valid(grade_raw), pc.cast(grade_raw, pa.string()), "")
    grade_lower = pc.utf8_lower(grade_str)
    grade_ok = pc.is_in(grade_lower, value_set=pa.array(["a", "b", "c", "d", "e"]))
    mask = pc.and_(mask, grade_ok)

    # Get scans for survivors, build (global_index, scans) pairs
    mask_list = mask.to_pylist()
    scans_list = scalar_table.column("unique_scans_n").to_pylist()
    del scalar_table, comp, mask, grade_raw, grade_str, grade_lower, grade_ok

    # Over-provision 3x to account for Python-gate attrition
    buffer_limit = limit * 3
    candidates: list[tuple[int, int]] = []
    for i, (ok, scans) in enumerate(zip(mask_list, scans_list)):
        if ok:
            candidates.append((i, scans if scans is not None else 0))
    del mask_list, scans_list

    logger.info("Pass 1 done: %d rows passed scalar filters", len(candidates))

    # Sort by scans desc, keep top buffer_limit
    candidates.sort(key=lambda x: x[1], reverse=True)
    candidates = candidates[:buffer_limit]
    target_indices = set(i for i, _ in candidates)
    del candidates
    logger.info("Need %d candidate rows for Pass 2", len(target_indices))

    # ---- PASS 2: Stream batches, process only target rows -----------------
    logger.info("Pass 2: Streaming full data, extracting %d target rows ...", len(target_indices))

    survivors: list[dict] = []
    global_offset = 0
    batch_num = 0

    for batch in pf.iter_batches(batch_size=100_000, columns=_ALL_COLUMNS):
        batch_num += 1
        batch_len = len(batch)
        batch_end = global_offset + batch_len

        # Quick check: does this batch contain any target rows?
        batch_targets = [
            i - global_offset
            for i in target_indices
            if global_offset <= i < batch_end
        ]

        if batch_targets:
            # Convert only needed columns to Python lists
            codes = batch.column("code").to_pylist()
            pnames = batch.column("product_name").to_pylist()
            brands = batch.column("brands").to_pylist()
            cats = batch.column("categories").to_pylist()
            ctags = batch.column("countries_tags").to_pylist()
            nuts = batch.column("nutriments").to_pylist()
            servs = batch.column("serving_size").to_pylist()
            scans = batch.column("unique_scans_n").to_pylist()

            for local_idx in batch_targets:
                # Gate: English market
                if not _is_english_market(ctags[local_idx]):
                    continue

                # Gate: English name
                name = _extract_english_name(pnames[local_idx])
                if not name or len(name) > 120:
                    continue

                # Gate: Nutriments
                macros = _extract_nutriments(nuts[local_idx])
                kcal = macros.get("energy_kcal_100g")
                if kcal is None or kcal <= 0:
                    continue

                # Gate: Macro coverage
                if sum(1 for v in macros.values() if v is not None) < 3:
                    continue

                survivors.append({
                    "code": codes[local_idx] or "",
                    "product_name": name,
                    "brands": brands[local_idx] or "",
                    "categories": cats[local_idx] or "",
                    "energy_kcal_100g": macros["energy_kcal_100g"],
                    "proteins_100g": macros["proteins_100g"],
                    "carbohydrates_100g": macros["carbohydrates_100g"],
                    "fat_100g": macros["fat_100g"],
                    "serving_size": servs[local_idx] or "",
                    "unique_scans_n": scans[local_idx] or 0,
                })

        global_offset = batch_end

        if batch_num % 10 == 0:
            logger.info("  Batch %d: %d rows read, %d survivors", batch_num, global_offset, len(survivors))

        # Early exit: all targets found
        if global_offset > max(target_indices, default=0):
            break

    # Final sort (already mostly sorted, but survivors come from different batches)
    survivors.sort(key=lambda r: r.get("unique_scans_n") or 0, reverse=True)
    survivors = survivors[:limit]
    logger.info("Pass 2 done: %d final products", len(survivors))

    # ---- Write CSV --------------------------------------------------------
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=_CSV_HEADER)
        writer.writeheader()
        writer.writerows(survivors)

    logger.info("Wrote %d rows to %s", len(survivors), output_path)
    print(  # noqa: T201
        f"\nSummary:\n"
        f"  Input rows:              {total_input:>8,}\n"
        f"  Final products:          {len(survivors):>8,}\n"
        f"  Output: {output_path}\n"
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Filter Open Food Facts Parquet into a flat CSV for catalog seeding.",
    )
    parser.add_argument(
        "--seeds-dir",
        default=str(Path(__file__).resolve().parent.parent.parent / "seeds"),
        help="Directory containing food.parquet (default: <repo>/seeds/)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5000,
        help="Maximum number of products to keep (default: 5000)",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = _parse_args()
    _run(args.seeds_dir, args.limit)
