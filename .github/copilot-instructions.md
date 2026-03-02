# Copilot Instructions for dogma-imperialis

## Project Overview
Warhammer 40K quote database. Users can browse, search, and filter ~2,700 quotes by tags. Moderator can edit/delete quotes directly via authenticated UI.

**Live site:** https://dogma-imperialis.com/  
**Firebase project:** `dogma-imperialis` (europe-west3)  
**Algolia index:** `prod_QUOTES`

## Tech Stack (as of March 2026 refresh)
- **Frontend:** React 18, Vite 6, react-instantsearch v7 (hooks API)
- **Backend:** Firebase Cloud Functions v2 (Node 22), firebase-admin v13, firebase-functions v6
- **Search:** Algolia (algoliasearch v5)
- **Database:** Cloud Firestore
- **Hosting:** Firebase Hosting (serves from `build/` directory)
- **Auth:** Firebase Auth (Google sign-in, single moderator UID: `gmhoL3b4R1cRajWnAYBcm4vB9oX2`)

## Architecture
```
Firestore (quotes collection)
  ↕ Cloud Functions (v2 triggers: onCreate/onUpdate/onDelete)
Algolia (prod_QUOTES index)
  ↕ algoliasearch/lite (frontend, search-only key)
React UI (Vite-built SPA on Firebase Hosting)
```

## Credentials & Secrets
| What | Where | Gitignored |
|---|---|---|
| Algolia search-only key (frontend) | `.env` (`VITE_ALGOLIA_*`) | Yes |
| Algolia admin key (functions) | `functions/.env` (`ALGOLIA_*`) | Yes |
| GCP service account | `dogma-imperialis-*.json` in repo root | Yes |
| Firebase config (public) | Hardcoded in `src/components/firebase/firebase.js` | No (safe, public keys) |
| Legacy runtime config backup | `.runtimeconfig-backup.json` | Yes |

## Key Files
- `src/index.jsx` — App entry point, Algolia InstantSearch provider
- `src/components/firebase/firebase.js` — Firebase modular SDK init (v11)
- `src/components/quotationEditForm.jsx` — Quote edit/delete form (mod + public suggestion)
- `src/components/debouncedSearch.jsx` — Debounced search box (useSearchBox hook)
- `src/components/debouncedRefListSearch.jsx` — Debounced tag filter (useRefinementList hook)
- `functions/index.js` — Cloud Functions: Algolia sync triggers + bulk reindex endpoint
- `functions/.env` — Algolia admin credentials for Cloud Functions

## Commands
```bash
npm run start    # Dev server (Vite)
npm run build    # Production build → build/
npm run preview  # Preview production build locally

firebase deploy --only hosting    # Deploy frontend
firebase deploy --only functions  # Deploy Cloud Functions
firebase deploy                   # Deploy everything
```

## DO NOT
- Use `functions.config()` — **retired**. Use `process.env.*` with `functions/.env`
- Use `react-instantsearch-dom` — **removed in v7**. Use `react-instantsearch`
- Use connectors (`connectSearchBox`, `connectRefinementList`, `connectStateResults`) — use hooks (`useSearchBox`, `useRefinementList`, `useInstantSearch`)
- Use namespaced Firebase SDK (`firebase.firestore()`, `firebase.auth()`) — use modular imports (`getFirestore`, `getAuth`, etc.)
- Use `ReactDOM.render()` — use `createRoot` (React 18)
- Use `algoliasearch` v4 `.initIndex()` — use v5 `client.saveObject({ indexName, body })` pattern
- Use `react-scripts` or CRA — project uses Vite
- Add `axios` — was removed (only used for deleted email feature)
- Use `.js` extension for files containing JSX — use `.jsx`
- Put secrets in source code — use `.env` files (gitignored)

## Firestore Rules
Single moderator UID hardcoded in `firestore.rules`. Public read, mod-only write.

## Scrapers Pipeline
The `scrapers/` directory contains a Python pipeline for refreshing the quote database. Run in order:
1. `scraper-lexicanum-v2.py` — Scrape Lexicanum wiki
2. `dedup-lexicanum.py` — Deduplicate raw scrape
3. `export_firestore.py` — Export current Firestore data
4. `merge_data.py` — Merge Firestore export + fresh scrape
5. `dedup_merged.py` — Remove near-duplicates from merged set
6. `chunk_by_page.py` — Split into per-page JSON chunks
7. `llm_normalize.py` — Send chunks to Claude Haiku for tag/source normalisation (resumable)
8. `upload_firestore.py` — Upload cleaned data to Firestore (supports `--dry-run`, `--delete-old`)

Requires: Python 3.11 venv in `scrapers/.venv/`, `ANTHROPIC_API_KEY` in root `.env`, GCP service account key in repo root.
Intermediate data (`chunks/`, `chunks_cleaned/`, `*.json`, `*.log`) is gitignored.

## Contact Form / Email Feature
**Removed** in March 2026 refresh. The `contactFormSubmit` Cloud Function and `blockSignup` auth trigger were deleted. The form's non-mod path now shows "temporarily unavailable". If re-implementing, consider a transactional email service (SendGrid, Resend) instead of Gmail.
