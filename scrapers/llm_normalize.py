#!/usr/bin/env python3
"""
Send each chunk to Claude Haiku for normalization, dedup, and cleanup.
Reads from chunks/, writes cleaned results to chunks_cleaned/.

Usage:
    python llm_normalize.py                  # Process all unprocessed chunks
    python llm_normalize.py Squat_Quotes     # Process a single chunk
    python llm_normalize.py --dry-run        # Show what would be sent (no API call)
"""

import json
import sys
import time
from pathlib import Path

import anthropic
import httpx
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR.parent / ".env")  # .env is in project root
CHUNKS_DIR = SCRIPT_DIR / "chunks"
OUTPUT_DIR = SCRIPT_DIR / "chunks_cleaned"
MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 16000
# Max chars per API call input. Output ≈ input size, so keep batches moderate.
MAX_CHARS_PER_CALL = 40_000

SYSTEM_PROMPT = """\
You are a data normalization assistant for a Warhammer 40,000 quote database.
You receive a JSON array of quote objects and must return a cleaned JSON array.

## Your tasks

### 1. Text normalization (field: "text")
- Fix double spaces → single space
- Remove [Note X], [Needs Citation], [1a], [1], [2a] etc. reference markers
- Replace Unicode smart quotes (\u2018\u2019\u201c\u201d) with ASCII (' and ")
- Replace em-dashes (\u2014) and en-dashes (\u2013) with ASCII hyphens (-)
- Replace non-breaking spaces (\\xa0) with normal spaces
- Remove "-Excerpt" or "- Excerpt" suffixed to the end of quote text
- Fix missing spaces (e.g. "word.Next" → "word. Next" only if clearly a sentence boundary)
- Trim leading/trailing whitespace
- IMPORTANT: Remove trailing contextual descriptions/attributions appended after the quote.
  These are NOT part of the quote itself — they describe context (who said it to whom, when/where).
  They typically start with a dash after the quote ends, e.g.:
    "...shall we ever see her like?- on the disappearance of Saint Celestine" → remove "- on the disappearance of Saint Celestine"
    "...I'll show you plenty.- to Warmaster Slaydo, during the invasion of Formal Prime" → remove "- to Warmaster Slaydo, during the invasion of Formal Prime"
    "...WHY NOT ME?!- on Isstvan III" → remove "- on Isstvan III"
    "...no warrior at all.- to Battle-Captain Garro" → remove "- to Battle-Captain Garro"
  Common patterns: "- to [Person]", "- on [Event]", "- at [Location]", "- during [Event]",
  "- before/after [Event]", "- regarding [Topic]", "- on being [description]",
  "- speaking to [Person]", "- about [Topic]", "- in response to [Person]"
  When removing, append the removed description to lore_source_txtonly (and lore_source)
  if it contains useful info not already there (e.g. "to Battle-Captain Garro" adds context).
  Be careful NOT to remove legitimate dialogue dashes within quotes (e.g. "- Yes. - No." is dialogue).

### 2. Source normalization (fields: "lore_source_txtonly", "real_source_txtonly")
- Same Unicode/whitespace fixes as text
- Remove [Needs Citation] markers
- Standardize page references: use "pg." consistently (not "p." or "page")
- Standardize chapter references: use "Ch." consistently (not "ch." or "Chapter")
- Fix comma spacing: "Word,Word" → "Word, Word"  
- Remove "by " prefix in lore_source_txtonly if it starts with "by Author" (e.g. "by Dan Abnett" → "Dan Abnett")
- Do NOT modify the HTML versions (lore_source, real_source) - only the _txtonly fields

### 3. Tag normalization (field: "tags")
- Trim leading/trailing whitespace from each tag
- Do NOT rename, merge, or remove tags - only trim whitespace

### 4. Duplicate detection
- If two quotes in this batch have nearly identical text (minor wording differences, one is a subset of the other, or differ only in punctuation/formatting), merge them:
  - Keep the longer/more complete text
  - Combine lore_source and real_source (semicolon-separated if different)
  - Merge tags (union)
  - Keep _firestore_id if either has one
  - Add "_merged_from": <count> to indicate a merge happened

### 5. What NOT to do
- Do NOT change the meaning or wording of quotes
- Do NOT translate or "improve" the prose
- Do NOT modify "found_on", "on", "source_page", "normtext", or "_firestore_id" fields
- Do NOT add or remove quotes (except merging duplicates)
- Do NOT modify HTML in "lore_source" or "real_source" fields

## Output format
Return ONLY a valid JSON array. No markdown fences, no commentary, no explanation.
Every object in the output must have the same fields as the input.\
"""


def build_user_prompt(quotes):
    """Build the user message with the quotes to normalize."""
    return (
        f"Here are {len(quotes)} quotes to normalize. "
        f"Return the cleaned JSON array.\n\n"
        f"{json.dumps(quotes, indent=2, ensure_ascii=False)}"
    )


def log(msg):
    print(msg, flush=True)


def call_haiku(quotes, label, client, tag="", max_retries=5):
    """Send a batch of quotes to Haiku and return the cleaned list."""
    user_msg = build_user_prompt(quotes)
    token_estimate = len(user_msg) // 3

    log(f"  {tag}  {label}: {len(quotes)} quotes, {len(user_msg):,} chars (~{token_estimate:,} tokens)")

    # Scale max_tokens to input size (output ~= input size for normalization)
    # Use 1.3x input estimate + buffer to avoid truncation
    scaled_max = min(max(int(token_estimate * 1.3) + 4000, MAX_TOKENS), 64000)

    for attempt in range(1, max_retries + 1):
        try:
            start = time.time()

            # Increase max_tokens on retries (helps when output is truncated)
            attempt_max = min(scaled_max + (attempt - 1) * 4000, 64000)

            # Use streaming to avoid timeout on large requests
            result_parts = []
            with client.messages.stream(
                model=MODEL,
                max_tokens=attempt_max,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
            ) as stream:
                for text in stream.text_stream:
                    result_parts.append(text)

            response = stream.get_final_message()
            elapsed = time.time() - start
            log(f"  {tag}  Response in {elapsed:.1f}s | {response.usage.input_tokens} in, {response.usage.output_tokens} out")

            # Check for truncation
            if response.stop_reason != "end_turn":
                log(f"  {tag}  WARNING: stop_reason={response.stop_reason} (may be truncated)")

            result_text = "".join(result_parts).strip()

            # Strip markdown fences if present
            if result_text.startswith("```"):
                lines = result_text.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                result_text = "\n".join(lines)

            cleaned = json.loads(result_text)
            if not isinstance(cleaned, list):
                raise ValueError(f"Response is not a list (got {type(cleaned).__name__})")
            return cleaned

        except KeyboardInterrupt:
            raise  # Don't retry on user interrupt
        except Exception as e:
            log(f"  {tag}  Attempt {attempt}/{max_retries} failed: {e}")
            is_rate_limit = "429" in str(e) or "rate_limit" in str(e)
            if attempt < max_retries:
                wait = 30 if is_rate_limit else 10 * attempt
                log(f"  {tag}  Retrying in {wait}s...")
                time.sleep(wait)
            else:
                raise


def split_quotes(quotes, max_chars):
    """Split quotes into sub-batches that fit within max_chars."""
    batches = []
    current = []
    current_size = 0

    for q in quotes:
        q_size = len(json.dumps(q, ensure_ascii=False))
        if current and current_size + q_size > max_chars:
            batches.append(current)
            current = []
            current_size = 0
        current.append(q)
        current_size += q_size

    if current:
        batches.append(current)
    return batches


def process_chunk(chunk_path, dry_run=False):
    """Send a single chunk to Haiku and save the result."""
    quotes = json.load(open(chunk_path, encoding="utf-8"))
    chunk_name = chunk_path.stem

    total_chars = len(json.dumps(quotes, ensure_ascii=False))
    tag = f"[{chunk_name}]"
    log(f"\n{'='*60}")
    log(f"{tag} Processing: {len(quotes)} quotes, {total_chars:,} chars")

    if dry_run:
        batches = split_quotes(quotes, MAX_CHARS_PER_CALL)
        log(f"  {tag} [DRY RUN] Would split into {len(batches)} batch(es)")
        for i, batch in enumerate(batches):
            sz = len(json.dumps(batch, ensure_ascii=False))
            log(f"    Batch {i+1}: {len(batch)} quotes, {sz:,} chars")
        return None

    client = anthropic.Anthropic(
        timeout=httpx.Timeout(600.0, connect=30.0),
    )
    batches = split_quotes(quotes, MAX_CHARS_PER_CALL)

    if len(batches) > 1:
        log(f"  {tag} Splitting into {len(batches)} batches")

    # Check for partial progress from a previous interrupted run
    partial_path = OUTPUT_DIR / f"{chunk_name}_partial.json"
    all_cleaned = []
    start_batch = 0
    if partial_path.exists():
        partial = json.load(open(partial_path, encoding="utf-8"))
        start_batch = partial["next_batch"]
        all_cleaned = partial["quotes"]
        log(f"  {tag} Resuming from batch {start_batch + 1} ({len(all_cleaned)} quotes already done)")

    for i, batch in enumerate(batches):
        if i < start_batch:
            continue
        label = f"Batch {i+1}/{len(batches)}" if len(batches) > 1 else "Sending"
        try:
            cleaned = call_haiku(batch, label, client, tag=tag)
            all_cleaned.extend(cleaned)
        except KeyboardInterrupt:
            # Save partial progress before exiting
            if all_cleaned:
                partial_data = {"next_batch": i, "quotes": all_cleaned}
                with open(partial_path, "w", encoding="utf-8") as f:
                    json.dump(partial_data, f, indent=2, ensure_ascii=False)
                log(f"  {tag} Saved partial progress ({len(all_cleaned)} quotes) to {partial_path}")
            raise
        except Exception as e:
            log(f"  {tag} ERROR in batch {i+1}: {e}")
            # Save partial progress so we can resume
            if all_cleaned:
                partial_data = {"next_batch": i, "quotes": all_cleaned}
                with open(partial_path, "w", encoding="utf-8") as f:
                    json.dump(partial_data, f, indent=2, ensure_ascii=False)
                log(f"  {tag} Saved partial progress ({len(all_cleaned)} quotes) to {partial_path}")
            return None

        if len(batches) > 1 and i < len(batches) - 1:
            time.sleep(1)

    # Stats
    merges = sum(1 for q in all_cleaned if q.get("_merged_from"))
    log(f"  {tag} Result: {len(all_cleaned)} quotes (was {len(quotes)}, delta {len(all_cleaned) - len(quotes):+d})")
    if merges:
        log(f"  {tag} Merges: {merges}")

    # Save final output and remove partial file
    OUTPUT_DIR.mkdir(exist_ok=True)
    out_path = OUTPUT_DIR / f"{chunk_name}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_cleaned, f, indent=2, ensure_ascii=False)
    if partial_path.exists():
        partial_path.unlink()
    log(f"  {tag} DONE -> {out_path.name}")

    return all_cleaned


def main():
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    args = [a for a in args if a != "--dry-run"]

    OUTPUT_DIR.mkdir(exist_ok=True)

    if args:
        # Process specific chunk(s)
        for name in args:
            if not name.endswith(".json"):
                name += ".json"
            path = CHUNKS_DIR / name
            if not path.exists():
                log(f"ERROR: {path} not found")
                continue
            process_chunk(path, dry_run=dry_run)
    else:
        # Process all unprocessed chunks (sequential - rate limit is 10k output tokens/min)
        chunks = sorted(CHUNKS_DIR.glob("*.json"))
        already_done = {f.stem for f in OUTPUT_DIR.glob("*.json")}
        todo = [c for c in chunks if c.stem not in already_done]

        log(f"Chunks: {len(chunks)} total, {len(already_done)} done, {len(todo)} remaining")

        failed = 0
        for i, chunk_path in enumerate(todo):
            result = process_chunk(chunk_path, dry_run=dry_run)
            if result is None and not dry_run:
                failed += 1

    # Summary
    if not dry_run:
        done = list(OUTPUT_DIR.glob("*.json"))
        total_quotes = sum(len(json.load(open(f, encoding="utf-8"))) for f in done)
        log(f"\n{'='*60}")
        log(f"Done: {len(done)} chunks cleaned, {total_quotes} total quotes")
        if failed:
            log(f"Failed: {failed} chunks (re-run to retry)")


if __name__ == "__main__":
    main()
