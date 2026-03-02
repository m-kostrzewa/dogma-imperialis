#!/usr/bin/env python3
"""
Reassemble cleaned chunks and upload to Firestore.

- Quotes WITH _firestore_id → update existing doc
- Quotes WITHOUT _firestore_id → create new doc (auto-ID)
- --delete-old flag: delete orphan docs listed in orphans.json
- Strips internal fields (_firestore_id, _merged_from, normtext) before writing

Uses batched writes (max 500 ops per Firestore batch).
"""

import argparse
import json
import os
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
SERVICE_ACCOUNT = PROJECT_ROOT / "dogma-imperialis-8ae6710edfe8.json"
CHUNKS_DIR = SCRIPT_DIR / "chunks_cleaned"
ORPHANS_FILE = SCRIPT_DIR / "orphans.json"

# Fields to strip before writing to Firestore
INTERNAL_FIELDS = {"_firestore_id", "_merged_from", "normtext"}

# Max operations per Firestore batch
BATCH_LIMIT = 500


def load_all_quotes():
    """Load and reassemble all cleaned chunks."""
    all_quotes = []
    for fn in sorted(os.listdir(CHUNKS_DIR)):
        if not fn.endswith(".json"):
            continue
        with open(CHUNKS_DIR / fn, encoding="utf-8") as f:
            chunk = json.load(f)
        all_quotes.extend(chunk)
        print(f"  Loaded {fn}: {len(chunk)} quotes")
    return all_quotes


def load_orphans():
    """Load orphan doc IDs from orphans.json."""
    if not ORPHANS_FILE.exists():
        return []
    with open(ORPHANS_FILE, encoding="utf-8") as f:
        orphans = json.load(f)
    return [o["_firestore_id"] for o in orphans]


def clean_doc(quote):
    """Strip internal fields, return clean dict for Firestore."""
    return {k: v for k, v in quote.items() if k not in INTERNAL_FIELDS}


def upload(dry_run=False, delete_old=False):
    print("Loading cleaned chunks...")
    all_quotes = load_all_quotes()
    print(f"\nTotal quotes: {len(all_quotes)}")

    updates = [(q["_firestore_id"], q) for q in all_quotes if q.get("_firestore_id")]
    inserts = [q for q in all_quotes if not q.get("_firestore_id")]
    print(f"Updates (existing docs): {len(updates)}")
    print(f"Inserts (new docs): {len(inserts)}")

    orphan_ids = []
    if delete_old:
        orphan_ids = load_orphans()
        print(f"Orphans to delete: {len(orphan_ids)}")

    total_ops = len(updates) + len(inserts) + len(orphan_ids)
    print(f"\nTotal Firestore operations: {total_ops}")

    if dry_run:
        print("\n[DRY RUN] No changes made.")
        return

    # Init Firebase
    cred = credentials.Certificate(str(SERVICE_ACCOUNT))
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    col_ref = db.collection("quotes")

    # Process in batches of BATCH_LIMIT
    ops_done = 0

    # --- Updates ---
    print(f"\n--- Updating {len(updates)} existing docs ---")
    batch = db.batch()
    batch_count = 0
    for doc_id, quote in updates:
        doc_ref = col_ref.document(doc_id)
        batch.set(doc_ref, clean_doc(quote))
        batch_count += 1
        if batch_count >= BATCH_LIMIT:
            batch.commit()
            ops_done += batch_count
            print(f"  Committed batch ({ops_done}/{len(updates)} updates)")
            batch = db.batch()
            batch_count = 0
    if batch_count > 0:
        batch.commit()
        ops_done += batch_count
        print(f"  Committed final update batch ({ops_done}/{len(updates)} updates)")

    # --- Inserts ---
    print(f"\n--- Inserting {len(inserts)} new docs ---")
    ops_done = 0
    batch = db.batch()
    batch_count = 0
    for quote in inserts:
        doc_ref = col_ref.document()  # auto-ID
        batch.set(doc_ref, clean_doc(quote))
        batch_count += 1
        if batch_count >= BATCH_LIMIT:
            batch.commit()
            ops_done += batch_count
            print(f"  Committed batch ({ops_done}/{len(inserts)} inserts)")
            batch = db.batch()
            batch_count = 0
    if batch_count > 0:
        batch.commit()
        ops_done += batch_count
        print(f"  Committed final insert batch ({ops_done}/{len(inserts)} inserts)")

    # --- Deletions ---
    if delete_old and orphan_ids:
        print(f"\n--- Deleting {len(orphan_ids)} orphan docs ---")
        ops_done = 0
        batch = db.batch()
        batch_count = 0
        for doc_id in orphan_ids:
            doc_ref = col_ref.document(doc_id)
            batch.delete(doc_ref)
            batch_count += 1
            if batch_count >= BATCH_LIMIT:
                batch.commit()
                ops_done += batch_count
                print(f"  Committed batch ({ops_done}/{len(orphan_ids)} deletes)")
                batch = db.batch()
                batch_count = 0
        if batch_count > 0:
            batch.commit()
            ops_done += batch_count
            print(f"  Committed final delete batch ({ops_done}/{len(orphan_ids)} deletes)")

    print("\n=== Upload complete ===")
    print(f"Updated: {len(updates)}, Inserted: {len(inserts)}, Deleted: {len(orphan_ids)}")
    expected_total = 1778 - len(orphan_ids) + len(inserts)
    print(f"Expected Firestore doc count: ~{expected_total}")


def main():
    parser = argparse.ArgumentParser(description="Upload cleaned quotes to Firestore")
    parser.add_argument("--dry-run", action="store_true", help="Print plan without writing")
    parser.add_argument("--delete-old", action="store_true", help="Delete orphan docs from orphans.json")
    args = parser.parse_args()
    upload(dry_run=args.dry_run, delete_old=args.delete_old)


if __name__ == "__main__":
    main()
