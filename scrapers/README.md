# Scrapers & Data Pipeline

Python scripts for scraping, deduplicating, normalising, and uploading Warhammer 40K quotes to Firestore.

## Setup

```bash
cd scrapers
python -m venv .venv
.venv/Scripts/Activate.ps1          # Windows
pip install firebase-admin anthropic beautifulsoup4 requests
```

Requires:
- `../.env` with `ANTHROPIC_API_KEY` (for LLM normalisation)
- `../dogma-imperialis-*.json` service account key (for Firestore access)

## Pipeline

Run in order:

### 1. Scrape

```bash
python scraper-lexicanum-v2.py
```

Scrapes quotes from Lexicanum wiki pages → `data/lexicanum.txt`.

### 2. Deduplicate raw scrape

```bash
python dedup-lexicanum.py
```

Removes exact duplicates from scraped data.

### 3. Export existing Firestore data

```bash
python export_firestore.py
```

Exports current Firestore `quotes` collection → `firestore_export.json`.

### 4. Merge

```bash
python merge_data.py
```

Merges Firestore export + fresh scrape, preserving Firestore doc IDs → `merged_deduped.json`.

### 5. Deduplicate merged data

```bash
python dedup_merged.py
```

Removes near-duplicates from merged dataset using normalised text comparison.

### 6. Chunk by source page

```bash
python chunk_by_page.py
```

Splits merged data into per-page JSON files → `chunks/`.

### 7. LLM normalise

```bash
python llm_normalize.py            # Process all remaining chunks
python llm_normalize.py --dry-run  # Preview what would be processed
```

Sends each chunk to Claude Haiku for tag/source normalisation → `chunks_cleaned/`. Supports resume (skips already-completed chunks). Wrapper script for logging:

```powershell
powershell -ExecutionPolicy Bypass -File run_normalize.ps1
```

### 8. Upload to Firestore

```bash
python upload_firestore.py --dry-run       # Preview counts
python upload_firestore.py                 # Upload (update existing + insert new)
python upload_firestore.py --delete-old    # Also delete orphan docs listed in orphans.json
```

Reassembles cleaned chunks and writes to Firestore. Algolia sync happens automatically via Cloud Function triggers.
