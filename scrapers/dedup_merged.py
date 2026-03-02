"""
Dedup the full merged dataset by normtext.
When merging duplicates, combine sources, tags, and keep _firestore_id if any.
"""
import json
import string
import re
import sys


def normalize_text(text):
    q = text.lower().strip()
    q = re.sub(r"\s\s+", " ", q)
    for p in string.punctuation:
        q = q.replace(p, "")
    return q


def main():
    data = json.load(open("merged_dataset.json", "r", encoding="utf-8"))
    print(f"Input: {len(data)} quotes", file=sys.stderr)

    # Ensure all have normtext
    for q in data:
        if "normtext" not in q or not q["normtext"]:
            q["normtext"] = normalize_text(q["text"])

    # Sort by normtext for adjacent dedup
    data.sort(key=lambda x: x["normtext"])

    found = 0
    i = 0
    n = len(data) - 1

    while i < n:
        if data[i]["normtext"] == data[i + 1]["normtext"]:
            # Merge i+1 into i
            a, b = data[i], data[i + 1]

            # Prefer the one with _firestore_id
            if "_firestore_id" not in a and "_firestore_id" in b:
                data[i], data[i + 1] = b, a
                a, b = data[i], data[i + 1]

            # Combine lore_source if different
            if a.get("lore_source_txtonly", "") and b.get("lore_source_txtonly", ""):
                if b["lore_source_txtonly"] not in a["lore_source_txtonly"]:
                    a["lore_source"] = a.get("lore_source", "") + "; " + b.get("lore_source", "")
                    a["lore_source_txtonly"] = a.get("lore_source_txtonly", "") + "; " + b.get("lore_source_txtonly", "")

            # Combine real_source if different
            if a.get("real_source_txtonly", "") and b.get("real_source_txtonly", ""):
                if b["real_source_txtonly"] not in a["real_source_txtonly"]:
                    a["real_source"] = a.get("real_source", "") + "; " + b.get("real_source", "")
                    a["real_source_txtonly"] = a.get("real_source_txtonly", "") + "; " + b.get("real_source_txtonly", "")

            # Merge tags (unique)
            a_tags = a.get("tags", [])
            b_tags = b.get("tags", [])
            a["tags"] = a_tags + [t for t in b_tags if t not in a_tags]

            # Keep _firestore_id from either
            if "_firestore_id" not in a and "_firestore_id" in b:
                a["_firestore_id"] = b["_firestore_id"]

            # Keep longer text
            if len(b.get("text", "")) > len(a.get("text", "")):
                a["text"] = b["text"]

            # Keep topics if present
            if "topics" in b and "topics" not in a:
                a["topics"] = b["topics"]

            del data[i + 1]
            n -= 1
            found += 1
        else:
            i += 1

    print(f"Merged {found} duplicates", file=sys.stderr)
    print(f"Output: {len(data)} quotes", file=sys.stderr)

    with open("merged_deduped.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Wrote merged_deduped.json", file=sys.stderr)


if __name__ == "__main__":
    main()
