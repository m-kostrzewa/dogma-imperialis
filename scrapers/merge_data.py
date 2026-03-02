"""
Merge script: Compare fresh Lexicanum scrape against current Firestore data.

Strategy:
- Lexicanum quotes: Match by normtext. Identify NEW, UPDATED, UNCHANGED, REMOVED.
- Proverbinatus/Mechanicus/User-submitted: Keep as-is from Firestore (no new scrape).
- Produce a merged dataset with action annotations for review.
- Preserve _firestore_id for existing docs.

Output: merge_report.json (summary + lists) and merged_dataset.json (final dataset ready for upload).
"""

import json
import string
import re
import sys
from collections import defaultdict


def normalize_text(text):
    """Same normalization as dedup-lexicanum.py"""
    q = text.lower().strip()
    q = re.sub(r"\s\s+", " ", q)
    for p in string.punctuation:
        q = q.replace(p, "")
    return q


def is_lexicanum(quote):
    """Check if a quote came from Lexicanum"""
    found_on = quote.get("found_on", "")
    return "lexicanum" in found_on.lower()


def is_proverbinatus(quote):
    found_on = quote.get("found_on", "")
    return "proverbinatus" in found_on.lower()


def is_mechanicus(quote):
    found_on = quote.get("found_on", "")
    return "reddit" in found_on.lower()


def load_json(path):
    for enc in ("utf-8-sig", "utf-16", "utf-8"):
        try:
            with open(path, "r", encoding=enc) as f:
                return json.load(f)
        except (UnicodeDecodeError, UnicodeError):
            continue
    raise RuntimeError(f"Cannot decode {path}")


def main():
    # Load data
    print("Loading data...", file=sys.stderr)
    firestore = load_json("firestore_export.json")
    fresh_lex = load_json("dedup.out")
    proverbinatus = load_json("data/proverbinatus.txt")
    mechanicus = load_json("data/mechanicus.txt")

    print(f"  Firestore:     {len(firestore)} quotes", file=sys.stderr)
    print(f"  Fresh Lex:     {len(fresh_lex)} quotes", file=sys.stderr)
    print(f"  Proverbinatus: {len(proverbinatus)} quotes", file=sys.stderr)
    print(f"  Mechanicus:    {len(mechanicus)} quotes", file=sys.stderr)

    # Categorize Firestore quotes
    fs_lexicanum = []
    fs_proverbinatus = []
    fs_mechanicus = []
    fs_other = []

    for q in firestore:
        if is_lexicanum(q):
            fs_lexicanum.append(q)
        elif is_proverbinatus(q):
            fs_proverbinatus.append(q)
        elif is_mechanicus(q):
            fs_mechanicus.append(q)
        else:
            fs_other.append(q)

    print(f"\nFirestore breakdown:", file=sys.stderr)
    print(f"  Lexicanum:     {len(fs_lexicanum)}", file=sys.stderr)
    print(f"  Proverbinatus: {len(fs_proverbinatus)}", file=sys.stderr)
    print(f"  Mechanicus:    {len(fs_mechanicus)}", file=sys.stderr)
    print(f"  Other/User:    {len(fs_other)}", file=sys.stderr)

    # Build normtext index for Firestore Lexicanum quotes
    fs_lex_by_norm = {}
    fs_lex_dupes = 0
    for q in fs_lexicanum:
        norm = q.get("normtext") or normalize_text(q["text"])
        if norm in fs_lex_by_norm:
            fs_lex_dupes += 1
            existing = fs_lex_by_norm[norm]
            if len(q.get("text", "")) > len(existing.get("text", "")):
                fs_lex_by_norm[norm] = q
        else:
            fs_lex_by_norm[norm] = q

    if fs_lex_dupes:
        print(f"  (Firestore had {fs_lex_dupes} duplicate normtexts in Lexicanum set)", file=sys.stderr)

    # Build normtext index for fresh Lexicanum scrape
    fresh_by_norm = {}
    for q in fresh_lex:
        norm = q.get("normtext") or normalize_text(q["text"])
        fresh_by_norm[norm] = q

    # Also build prefix index for fuzzy matching (first 50 chars of normtext)
    FUZZY_PREFIX_LEN = 50
    fresh_by_prefix = {}
    for norm, q in fresh_by_norm.items():
        prefix = norm[:FUZZY_PREFIX_LEN]
        fresh_by_prefix.setdefault(prefix, []).append((norm, q))

    fs_by_prefix = {}
    for norm, q in fs_lex_by_norm.items():
        prefix = norm[:FUZZY_PREFIX_LEN]
        fs_by_prefix.setdefault(prefix, []).append((norm, q))

    # Compare Lexicanum quotes - Phase 1: exact normtext match
    new_quotes = []        # In fresh but not in Firestore
    updated_quotes = []    # In both, but content differs
    unchanged_quotes = []  # In both, same content
    removed_quotes = []    # In Firestore but not in fresh scrape
    fuzzy_updated = 0      # Count of fuzzy-matched updates

    matched_fresh = set()  # Track which fresh normtexts were matched
    matched_fs = set()     # Track which firestore normtexts were matched

    def compare_and_classify(fresh_q, fs_q, is_fuzzy=False):
        """Compare a fresh quote with a Firestore quote and classify the result."""
        changes = []
        if fresh_q.get("text", "").strip() != fs_q.get("text", "").strip():
            changes.append("text")
        if fresh_q.get("real_source_txtonly", "") != fs_q.get("real_source_txtonly", ""):
            changes.append("real_source")
        if fresh_q.get("lore_source_txtonly", "") != fs_q.get("lore_source_txtonly", ""):
            changes.append("lore_source")
        if sorted(fresh_q.get("tags", [])) != sorted(fs_q.get("tags", [])):
            changes.append("tags")

        if changes or is_fuzzy:
            if is_fuzzy and not changes:
                changes.append("normtext_only")
            updated_quotes.append({
                "_action": "update",
                "_changes": changes,
                "_fuzzy_match": is_fuzzy,
                "_firestore_id": fs_q["_firestore_id"],
                "_old": {k: fs_q.get(k) for k in ["text", "lore_source_txtonly", "real_source_txtonly", "tags"]},
                **fresh_q,
                "_firestore_id": fs_q["_firestore_id"],
            })
        else:
            unchanged_quotes.append({
                "_action": "keep",
                "_firestore_id": fs_q["_firestore_id"],
                **fs_q,
            })

    # Phase 1: Exact normtext matches
    for norm, fresh_q in fresh_by_norm.items():
        if norm in fs_lex_by_norm:
            matched_fresh.add(norm)
            matched_fs.add(norm)
            compare_and_classify(fresh_q, fs_lex_by_norm[norm])

    # Phase 2: Fuzzy matching for unmatched quotes (prefix-based)
    unmatched_fresh = {n: q for n, q in fresh_by_norm.items() if n not in matched_fresh}
    unmatched_fs = {n: q for n, q in fs_lex_by_norm.items() if n not in matched_fs}

    # Build prefix index for unmatched only
    unmatched_fresh_by_prefix = {}
    for norm, q in unmatched_fresh.items():
        prefix = norm[:FUZZY_PREFIX_LEN]
        unmatched_fresh_by_prefix.setdefault(prefix, []).append((norm, q))

    for fs_norm, fs_q in unmatched_fs.items():
        prefix = fs_norm[:FUZZY_PREFIX_LEN]
        if prefix in unmatched_fresh_by_prefix:
            candidates = unmatched_fresh_by_prefix[prefix]
            if len(candidates) == 1:
                fresh_norm, fresh_q = candidates[0]
                if fresh_norm not in matched_fresh:
                    matched_fresh.add(fresh_norm)
                    matched_fs.add(fs_norm)
                    fuzzy_updated += 1
                    compare_and_classify(fresh_q, fs_q, is_fuzzy=True)

    # Phase 3: Remaining unmatched
    for norm, fresh_q in fresh_by_norm.items():
        if norm not in matched_fresh:
            new_quotes.append({
                "_action": "add",
                **fresh_q,
            })

    for norm, fs_q in fs_lex_by_norm.items():
        if norm not in matched_fs:
            removed_quotes.append({
                "_action": "remove",
                "_firestore_id": fs_q["_firestore_id"],
                **fs_q,
            })

    # Non-Lexicanum quotes: keep as-is
    keep_proverbinatus = [{**q, "_action": "keep"} for q in fs_proverbinatus]
    keep_mechanicus = [{**q, "_action": "keep"} for q in fs_mechanicus]
    keep_other = [{**q, "_action": "keep"} for q in fs_other]

    print(f"\n=== MERGE RESULTS ===", file=sys.stderr)
    print(f"Lexicanum:", file=sys.stderr)
    print(f"  New quotes to add:    {len(new_quotes)}", file=sys.stderr)
    print(f"  Updated quotes:       {len(updated_quotes)} ({fuzzy_updated} via fuzzy match)", file=sys.stderr)
    print(f"  Unchanged:            {len(unchanged_quotes)}", file=sys.stderr)
    print(f"  Removed from source:  {len(removed_quotes)}", file=sys.stderr)
    print(f"Non-Lexicanum (kept):", file=sys.stderr)
    print(f"  Proverbinatus:        {len(keep_proverbinatus)}", file=sys.stderr)
    print(f"  Mechanicus:           {len(keep_mechanicus)}", file=sys.stderr)
    print(f"  Other/User:           {len(keep_other)}", file=sys.stderr)

    total_after = (len(new_quotes) + len(updated_quotes) + len(unchanged_quotes)
                   + len(removed_quotes)
                   + len(keep_proverbinatus) + len(keep_mechanicus) + len(keep_other))
    print(f"\nTotal after merge:      {total_after} (keeping removed)", file=sys.stderr)
    print(f"  (was {len(firestore)}, delta {total_after - len(firestore):+d})", file=sys.stderr)

    # Write merge report
    report = {
        "summary": {
            "firestore_total": len(firestore),
            "fresh_lexicanum": len(fresh_lex),
            "lexicanum_new": len(new_quotes),
            "lexicanum_updated": len(updated_quotes),
            "lexicanum_unchanged": len(unchanged_quotes),
            "lexicanum_removed": len(removed_quotes),
            "proverbinatus_kept": len(keep_proverbinatus),
            "mechanicus_kept": len(keep_mechanicus),
            "other_kept": len(keep_other),
            "total_after_merge": total_after,
        },
        "new_quotes": new_quotes[:20],  # Sample
        "updated_quotes": updated_quotes[:20],  # Sample
        "removed_quotes": removed_quotes[:20],  # Sample  
    }

    with open("merge_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nWrote merge_report.json (summary + samples)", file=sys.stderr)

    # Write full lists for detailed review
    with open("merge_new.json", "w", encoding="utf-8") as f:
        json.dump(new_quotes, f, indent=2, ensure_ascii=False)
    print(f"Wrote merge_new.json ({len(new_quotes)} new quotes)", file=sys.stderr)

    with open("merge_updated.json", "w", encoding="utf-8") as f:
        json.dump(updated_quotes, f, indent=2, ensure_ascii=False)
    print(f"Wrote merge_updated.json ({len(updated_quotes)} updated quotes)", file=sys.stderr)

    with open("merge_removed.json", "w", encoding="utf-8") as f:
        json.dump(removed_quotes, f, indent=2, ensure_ascii=False)
    print(f"Wrote merge_removed.json ({len(removed_quotes)} quotes removed from source)", file=sys.stderr)

    # Build final merged dataset (keeping removed quotes too)
    # For updates: use fresh data but keep _firestore_id
    merged = []

    for q in unchanged_quotes:
        out = {k: v for k, v in q.items() if not k.startswith("_")}
        out["_firestore_id"] = q["_firestore_id"]
        merged.append(out)

    for q in updated_quotes:
        out = {k: v for k, v in q.items() if not k.startswith("_")}
        out["_firestore_id"] = q["_firestore_id"]
        merged.append(out)

    for q in new_quotes:
        out = {k: v for k, v in q.items() if not k.startswith("_")}
        merged.append(out)

    # Keep removed quotes (no longer on Lexicanum but still valid)
    for q in removed_quotes:
        out = {k: v for k, v in q.items() if not k.startswith("_")}
        out["_firestore_id"] = q["_firestore_id"]
        merged.append(out)

    for q in keep_proverbinatus + keep_mechanicus + keep_other:
        out = {k: v for k, v in q.items() if not k.startswith("_")}
        if "_firestore_id" in q:
            out["_firestore_id"] = q["_firestore_id"]
        merged.append(out)

    with open("merged_dataset.json", "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
    print(f"Wrote merged_dataset.json ({len(merged)} total quotes)", file=sys.stderr)


if __name__ == "__main__":
    main()
