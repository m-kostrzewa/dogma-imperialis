# Dogma Imperialis

Warhammer 40,000 quote database. Browse, search, and filter ~2,700 quotes by tags.

**Live:** https://dogma-imperialis.com

## Tech Stack

- **Frontend:** React 18, Vite 6, react-instantsearch v7 (hooks API)
- **Backend:** Firebase Cloud Functions v2 (Node 22)
- **Search:** Algolia (`prod_QUOTES` index, synced automatically via Firestore triggers)
- **Database:** Cloud Firestore
- **Hosting:** Firebase Hosting
- **Auth:** Firebase Auth (Google sign-in, single moderator UID)

## Architecture

```
Firestore (quotes collection)
  ↕ Cloud Functions (onCreate / onUpdate / onDelete)
Algolia (prod_QUOTES index)
  ↕ algoliasearch/lite (frontend, search-only key)
React UI (Vite SPA on Firebase Hosting)
```

## Development

```bash
npm run start    # Dev server (Vite, port 5173)
npm run build    # Production build → build/
npm run preview  # Preview production build locally
```

## Deployment

```bash
firebase deploy --only hosting    # Frontend only
firebase deploy --only functions  # Cloud Functions only
firebase deploy                   # Everything
```

## Thought for the Day

Daily banner pairing a Warhammer 40K quote with a real-world news headline, selected by Claude Haiku (`claude-haiku-4-5-20251001`). Scheduled at 06:00 UTC via Cloud Functions; moderator can preview/save/discard manually.

- **AI:** Anthropic SDK (`@anthropic-ai/sdk`), model `claude-haiku-4-5-20251001`
- **News feeds:** BBC World News, Ars Technica, Space.com (RSS via `fast-xml-parser`), Hacker News API
- **Storage:** Firestore `daily_thought/{YYYY-MM-DD}` + `daily_thought/meta` (90-day dedup)
- **Propagation:** Quote edits in Firestore auto-update any `daily_thought` docs referencing that quote

## Search by Meaning (Semantic Search)

Vector-based search alongside Algolia text search, merged via Reciprocal Rank Fusion.

- **Embeddings:** Google `text-embedding-004` (768 dims) via Vertex AI REST API, stored as Firestore vector fields
- **Vector index:** Firestore single-field vector index (COSINE, flat), auto-queried by `semanticSearch` Cloud Function
- **Backfill:** `scrapers/compute_embeddings.py` (one-time, all ~2,700 docs)
- **Sync:** `onCreate`/`onUpdate` Cloud Function triggers call `computeEmbedding()` to keep vectors current
- **Frontend:** Custom `searchClient` proxy merges Algolia + semantic hits (RRF k=60); Text/Meaning checkboxes toggle modes; "matched by meaning" badge on semantic-only results

## Scrapers

The `scrapers/` directory contains a Python pipeline for scraping, deduplicating, normalising (via LLM), and uploading quotes to Firestore. See [scrapers/README.md](scrapers/README.md) for details.
