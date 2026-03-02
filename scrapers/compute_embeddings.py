#!/usr/bin/env python3
"""
Compute embeddings for all quotes in Firestore using Google's text-embedding-004
model (via Vertex AI REST API) and write them back as vector fields.

Idempotent: skips docs that already have an 'embedding' field.
Supports --dry-run to preview without writing.
Supports --force to recompute all embeddings (even if already present).

Usage:
    python compute_embeddings.py              # Backfill missing embeddings
    python compute_embeddings.py --dry-run    # Preview what would be done
    python compute_embeddings.py --force      # Recompute all embeddings
"""

import argparse
import json
import sys
import time
from pathlib import Path

import firebase_admin
import google.auth.transport.requests
import requests
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.vector import Vector
from google.oauth2 import service_account

# --- Configuration ---

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
SERVICE_ACCOUNT = PROJECT_ROOT / "dogma-imperialis-8ae6710edfe8.json"

PROJECT_ID = "dogma-imperialis"
REGION = "europe-west3"
MODEL_ID = "text-embedding-004"
EMBEDDING_DIM = 768

# Vertex AI REST endpoint
VERTEX_URL = (
    f"https://{REGION}-aiplatform.googleapis.com/v1/"
    f"projects/{PROJECT_ID}/locations/{REGION}/"
    f"publishers/google/models/{MODEL_ID}:predict"
)

# Vertex AI supports up to 250 texts per batch request.
# Keep batches moderate to avoid timeouts and stay within rate limits.
BATCH_SIZE = 100

# Firestore batched write limit
FIRESTORE_BATCH_LIMIT = 500

# Rate limiting: Vertex AI has per-minute quotas for embedding models.
# text-embedding-004 default quota is ~600 requests/min, but each batch counts
# as one request. Using a delay to avoid 429s.
BATCH_DELAY_SECONDS = 5.0

# Retry settings for 429 (rate limit) errors
MAX_RETRIES = 5
INITIAL_RETRY_DELAY = 30  # seconds — 429s need a longer backoff


def get_access_token():
    """Get an OAuth2 access token using the service account credentials."""
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    creds = service_account.Credentials.from_service_account_file(
        str(SERVICE_ACCOUNT), scopes=scopes
    )
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


def embed_texts(texts, access_token):
    """
    Call Vertex AI text-embedding-004 to embed a batch of texts.
    Returns a list of 768-dim float vectors, one per input text.
    Retries on 429 (rate limit) with exponential backoff.
    """
    instances = [{"content": t} for t in texts]
    payload = {
        "instances": instances,
        "parameters": {"outputDimensionality": EMBEDDING_DIM},
    }

    for attempt in range(MAX_RETRIES + 1):
        response = requests.post(
            VERTEX_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60,
        )

        if response.status_code == 200:
            break

        if response.status_code == 429 and attempt < MAX_RETRIES:
            delay = INITIAL_RETRY_DELAY * (2 ** attempt)
            print(f" rate limited, retrying in {delay}s...", end="", flush=True)
            time.sleep(delay)
            continue

        raise RuntimeError(
            f"Vertex AI API error {response.status_code}: {response.text[:500]}"
        )

    data = response.json()
    predictions = data.get("predictions", [])
    if len(predictions) != len(texts):
        raise RuntimeError(
            f"Expected {len(texts)} embeddings, got {len(predictions)}"
        )

    return [p["embeddings"]["values"] for p in predictions]


def main():
    parser = argparse.ArgumentParser(
        description="Backfill Firestore quotes with text-embedding-004 vectors"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print plan without writing to Firestore or calling the embedding API"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Recompute embeddings even for docs that already have one"
    )
    args = parser.parse_args()

    # --- Init Firebase ---
    cred = credentials.Certificate(str(SERVICE_ACCOUNT))
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    # --- Read all quotes ---
    print("Reading quotes from Firestore...", flush=True)
    all_docs = []
    for doc in db.collection("quotes").stream():
        all_docs.append((doc.id, doc.to_dict()))

    print(f"Total quotes in Firestore: {len(all_docs)}")

    # --- Filter to docs needing embeddings ---
    if args.force:
        to_process = [(doc_id, data) for doc_id, data in all_docs if data.get("text")]
        print(f"Force mode: will (re)compute embeddings for all {len(to_process)} docs")
    else:
        to_process = [
            (doc_id, data)
            for doc_id, data in all_docs
            if data.get("text") and "embedding" not in data
        ]
        already_done = len(all_docs) - len(to_process)
        print(f"Already have embeddings: {already_done}")
        print(f"Need embeddings: {len(to_process)}")

    if not to_process:
        print("Nothing to do — all quotes already have embeddings.")
        return

    if args.dry_run:
        print(f"\n[DRY RUN] Would compute embeddings for {len(to_process)} quotes.")
        print(f"  Batch size: {BATCH_SIZE}")
        print(f"  Number of API calls: {(len(to_process) + BATCH_SIZE - 1) // BATCH_SIZE}")
        print(f"  Estimated tokens: ~{len(to_process) * 50:,} ({len(to_process)} × ~50 tokens avg)")
        return

    # --- Get access token ---
    print("\nAuthenticating with Vertex AI...", flush=True)
    access_token = get_access_token()
    print("Authenticated.")

    # --- Process in batches ---
    total_batches = (len(to_process) + BATCH_SIZE - 1) // BATCH_SIZE
    total_written = 0
    start_time = time.time()

    for batch_idx in range(total_batches):
        batch_start = batch_idx * BATCH_SIZE
        batch_end = min(batch_start + BATCH_SIZE, len(to_process))
        batch_items = to_process[batch_start:batch_end]

        # Extract texts for embedding
        texts = [data.get("text", "") for _, data in batch_items]

        # Call Vertex AI
        print(
            f"  Batch {batch_idx + 1}/{total_batches}: "
            f"embedding {len(texts)} texts...",
            end="",
            flush=True,
        )

        try:
            vectors = embed_texts(texts, access_token)
        except RuntimeError as e:
            print(f" ERROR: {e}")
            print("Stopping. Documents processed so far are saved.")
            break

        # Write vectors back to Firestore in a batched write
        fs_batch = db.batch()
        for (doc_id, _), vector in zip(batch_items, vectors):
            doc_ref = db.collection("quotes").document(doc_id)
            fs_batch.update(doc_ref, {"embedding": Vector(vector)})

        fs_batch.commit()
        total_written += len(batch_items)

        elapsed = time.time() - start_time
        rate = total_written / elapsed if elapsed > 0 else 0
        print(f" done. ({total_written}/{len(to_process)}, {rate:.0f} docs/sec)")

        # Small delay between batches
        if batch_idx < total_batches - 1:
            time.sleep(BATCH_DELAY_SECONDS)

    elapsed = time.time() - start_time
    print(f"\n=== Embedding complete ===")
    print(f"Documents updated: {total_written}/{len(to_process)}")
    print(f"Time: {elapsed:.1f}s")


if __name__ == "__main__":
    main()
