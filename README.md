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

## Scrapers

The `scrapers/` directory contains a Python pipeline for scraping, deduplicating, normalising (via LLM), and uploading quotes to Firestore. See [scrapers/README.md](scrapers/README.md) for details.
