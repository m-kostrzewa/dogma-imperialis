#!/usr/bin/env python3
"""
Chunk merged_deduped.json by source_page field.
Quotes without source_page go into 'no_source_page.json'.
"""
import json, re
from pathlib import Path

INPUT = "merged_deduped.json"
OUT_DIR = Path("chunks")

def main():
    data = json.load(open(INPUT, encoding="utf-8"))
    print(f"Total: {len(data)} quotes")

    OUT_DIR.mkdir(exist_ok=True)

    buckets = {}
    for q in data:
        page = q.get("source_page", "") or "no_source_page"
        buckets.setdefault(page, []).append(q)

    total = 0
    for page, quotes in sorted(buckets.items(), key=lambda x: -len(x[1])):
        # Clean filename
        safe = re.sub(r' - Warhammer 40k - Lexicanum\.html$', '', page)
        safe = re.sub(r'[^\w\s\-\(\)]', '', safe).strip()
        safe = re.sub(r'\s+', '_', safe)
        if not safe:
            safe = "no_source_page"

        outpath = OUT_DIR / f"{safe}.json"
        with open(outpath, "w", encoding="utf-8") as f:
            json.dump(quotes, f, indent=2, ensure_ascii=False)
        total += len(quotes)
        print(f"  {len(quotes):4d} -> {outpath.name}")

    print(f"\nTotal written: {total}")

if __name__ == "__main__":
    main()
