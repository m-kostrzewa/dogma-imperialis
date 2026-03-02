"""
Lexicanum Quote Scraper v2 (March 2026)
Reads from locally-saved HTML files in html/ directory.
Handles both old 3-column tables and new 2-column + footnote format.
"""
import json
import sys
import re
import os
from datetime import datetime
from copy import copy

from bs4 import BeautifulSoup, Tag

# ── Configuration ──────────────────────────────────────────────────────────
HTML_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'html')

quote_urls = [
    {
        "tags": ["Thought for the day"],
        "url": "https://wh40k.lexicanum.com/wiki/Thought_for_the_day_(A_-_H)",
    },
    {
        "tags": ["Thought for the day"],
        "url": "https://wh40k.lexicanum.com/wiki/Thought_for_the_day_(I_-_P)",
    },
    {
        "tags": ["Thought for the day"],
        "url": "https://wh40k.lexicanum.com/wiki/Thought_for_the_day_(Q_-_Z)",
    },
    {
        "tags": ["Imperium of Man"],
        "url": "https://wh40k.lexicanum.com/wiki/Quotes_Imperium",
    },
    {
        "tags": ["Imperium of Man", "Adeptus Mechanicus"],
        "url": "https://wh40k.lexicanum.com/wiki/Quotes_Adeptus_Mechanicus",
    },
    {
        "tags": ["Imperium of Man", "Ecclesiarchy"],
        "url": "https://wh40k.lexicanum.com/wiki/Ecclesiarchy_Quotes",
    },
    {
        "tags": ["Imperium of Man", "Astra Militarum (Imperial Guard)"],
        "url": "https://wh40k.lexicanum.com/wiki/Quotes_Astra_Militarum",
    },
    {
        "tags": ["Imperium of Man", "Imperial Navy"],
        "url": "https://wh40k.lexicanum.com/wiki/Quotes_Imperial_Navy",
    },
    {
        "tags": ["Imperium of Man", "Inquisition"],
        "url": "https://wh40k.lexicanum.com/wiki/Inquisition_Quotes",
    },
    {
        "tags": ["Imperium of Man", "Officio Assassinorum"],
        "url": "https://wh40k.lexicanum.com/wiki/Officio_Assassinorum_Quotes",
    },
    {
        "tags": ["Imperium of Man", "Adeptus Astartes (Space Marines)"],
        "url": "https://wh40k.lexicanum.com/wiki/Quotes_Space_Marines",
    },
    {
        "tags": ["Imperium of Man", "Squat"],
        "url": "https://wh40k.lexicanum.com/wiki/Squat_Quotes",
    },
    {
        "tags": ["Imperium of Man", "Adeptus Arbites"],
        "url": "https://wh40k.lexicanum.com/wiki/Adeptus_Arbites_Quotes",
    },
    {
        "tags": ["Chaos"],
        "url": "https://wh40k.lexicanum.com/wiki/Quotes_Chaos",
    },
    {
        "tags": ["Eldar"],
        "url": "https://wh40k.lexicanum.com/wiki/Eldar_Quotes",
    },
    {
        "tags": ["Ork"],
        "url": "https://wh40k.lexicanum.com/wiki/Ork_Quotes",
    },
    {
        "tags": ["Tau"],
        "url": "https://wh40k.lexicanum.com/wiki/Tau_Quotes",
    },
    {
        "tags": ["Dark eldar"],
        "url": "https://wh40k.lexicanum.com/wiki/Dark_Eldar_Quotes",
    },
    {
        "tags": ["Tyranid"],
        "url": "https://wh40k.lexicanum.com/wiki/Tyranid_Quotes",
    },
    {
        "tags": ["Imperium of Man", "Adepta Sororitas (Sisters of Battle)"],
        "url": "https://wh40k.lexicanum.com/wiki/Adepta_Sororitas_Quotes",
    },
    {
        "tags": ["Imperium of Man", "Adeptus Custodes"],
        "url": "https://wh40k.lexicanum.com/wiki/Adeptus_Custodes_Quotes",
    },
    {
        "tags": ["Imperium of Man", "Adeptus Mechanicus", "Prayer"],
        "url": "https://wh40k.lexicanum.com/wiki/Cult_Mechanicus_Religious_Excerpts",
    },
    {
        "tags": ["Necrons"],
        "url": "https://wh40k.lexicanum.com/wiki/Necron_Quotes",
    },
    {
        "tags": ["Imperium of Man", "Tactica Imperium"],
        "url": "https://wh40k.lexicanum.com/wiki/Tactica_Imperium_passages",
    },
    {
        "tags": ["Eldar", "Corsair"],
        "url": "https://wh40k.lexicanum.com/wiki/Corsair_Quotes",
    },
    {
        "tags": ["Eldar", "Harlequin"],
        "url": "https://wh40k.lexicanum.com/wiki/Harlequin_Quotes",
    },
    {
        "tags": ["Leagues of Votann"],
        "url": "https://wh40k.lexicanum.com/wiki/Leagues_of_Votann_Quotes",
    },
]

# ── Helpers ────────────────────────────────────────────────────────────────

def url_to_local_file(url):
    """Map a Lexicanum URL to the corresponding local HTML file."""
    page_name = url.split('/wiki/')[-1]
    page_name_spaced = page_name.replace('_', ' ').replace('%28', '(').replace('%29', ')')

    html_files = []
    for fname in os.listdir(HTML_DIR):
        if fname.endswith('.html'):
            title = fname.replace(' - Warhammer 40k - Lexicanum.html', '')
            html_files.append((title, os.path.join(HTML_DIR, fname)))

    # Exact match
    for title, fpath in html_files:
        if title == page_name_spaced:
            return fpath

    # Handle Lexicanum redirects: "Quotes X" -> "X Quotes"
    if page_name_spaced.startswith('Quotes '):
        alt_name = page_name_spaced.replace('Quotes ', '') + ' Quotes'
        for title, fpath in html_files:
            if title == alt_name:
                return fpath

    # Fuzzy: word-set match (handles word reordering)
    page_words = set(page_name_spaced.lower().split())
    for title, fpath in html_files:
        if set(title.lower().split()) == page_words:
            return fpath

    # Even fuzzier: try substring containment both ways
    pn_lower = page_name_spaced.lower().replace('quotes', '').strip()
    for title, fpath in html_files:
        title_lower = title.lower().replace('quotes', '').strip()
        if pn_lower and title_lower and (pn_lower in title_lower or title_lower in pn_lower):
            return fpath

    raise FileNotFoundError(f"No local HTML for {url} (looked for '{page_name_spaced}')")


def build_footnote_map(soup):
    """
    Build a mapping from footnote ID (e.g. 'fn_34b') to the full source text.
    
    Footnotes are structured as:
    - Top-level: <li><span id="fn_1">1</span>: Source Name</li>
    - With sub-items: <li>4: Parent Source <ul><li><span id="fn_4a">4a</span>: pg. 17</li>...</ul></li>
    
    For sub-items, we combine: "Parent Source, pg. 17"
    """
    footnotes = {}  # fn_id -> source text (plain text)
    footnotes_html = {}  # fn_id -> source HTML

    # Find the Sources section
    sources_heading = soup.find('span', id='Sources')
    if not sources_heading:
        return footnotes, footnotes_html

    h = sources_heading.find_parent(['h2', 'h3'])
    if not h:
        return footnotes, footnotes_html

    # Walk siblings after the heading to find the source list
    # Sources can be in <ul> or <ol> or a <div> containing them
    source_container = None
    for sib in h.find_next_siblings():
        if sib.name in ['h2', 'h3']:
            break  # next section
        if sib.name in ['ul', 'ol']:
            source_container = sib
            break
        if sib.name == 'div':
            inner = sib.find(['ul', 'ol'])
            if inner:
                source_container = inner
                break

    if not source_container:
        return footnotes, footnotes_html

    # Process top-level list items
    for li in source_container.find_all('li', recursive=False):
        _process_source_li(li, None, None, footnotes, footnotes_html)

    return footnotes, footnotes_html


def _process_source_li(li, parent_text, parent_html, footnotes, footnotes_html):
    """Process a single source list item, recursing into sub-items."""
    fn_span = li.find('span', id=re.compile(r'^fn_'), recursive=False)

    # Get the source text for this item (excluding sub-lists)
    # Clone the li, remove sub-lists, get text
    li_clone = copy(li)
    for sub in li_clone.find_all(['ul', 'ol']):
        sub.decompose()

    item_text = li_clone.get_text().strip()
    # Remove leading "fn_num: " prefix
    item_text = re.sub(r'^\w+:\s*', '', item_text)

    # Get HTML version (links preserved)
    item_html = _extract_source_html(li, exclude_sublists=True)

    if fn_span:
        fn_id = fn_span.get('id')
        if parent_text and item_text:
            # Sub-item: combine parent source with sub-item detail
            full_text = f"{parent_text}, {item_text}"
            full_html = f"{parent_html}, {item_text}"
        else:
            full_text = item_text
            full_html = item_html

        footnotes[fn_id] = full_text
        footnotes_html[fn_id] = full_html

    # This item might be a parent with sub-items
    sub_list = li.find(['ul', 'ol'])
    if sub_list:
        # This item is a parent; use its text as parent context for children
        # The parent text is the source name (without the sub-item details)
        this_parent_text = item_text
        this_parent_html = item_html
        for sub_li in sub_list.find_all('li', recursive=False):
            _process_source_li(sub_li, this_parent_text, this_parent_html, footnotes, footnotes_html)


def _extract_source_html(li, exclude_sublists=True):
    """Extract HTML of a source list item, keeping <a> links."""
    li_copy = copy(li)
    if exclude_sublists:
        for sub in li_copy.find_all(['ul', 'ol']):
            sub.decompose()
    # Remove the fn span itself
    for span in li_copy.find_all('span', id=re.compile(r'^fn_')):
        span.decompose()

    html = ''.join(str(c) for c in li_copy.contents).strip()
    # Remove leading ": " or "num: "
    html = re.sub(r'^[\d\w]*:\s*', '', html)
    return html


def resolve_footnotes(cell, footnotes, footnotes_html):
    """
    Given a table cell that may contain <sup> footnote references,
    resolve them to source text. Returns (text, html) or (None, None).
    """
    sups = cell.find_all('sup')
    sources_text = []
    sources_html = []

    for sup in sups:
        a = sup.find('a')
        if a and a.get('href') and '#' in a['href']:
            fn_id = a['href'].split('#')[-1]
            if fn_id in footnotes:
                sources_text.append(footnotes[fn_id])
                sources_html.append(footnotes_html.get(fn_id, footnotes[fn_id]))

    if sources_text:
        return '; '.join(sources_text), '; '.join(sources_html)
    return None, None


def cleanup_sources(source):
    """Clean up a source cell's HTML, keeping only useful <a> links."""
    if isinstance(source, str):
        return source

    # Work on a copy to avoid mutating the DOM
    source = copy(source)

    for a in source.find_all('a'):
        remove = False
        href = str(a.get('href', ''))
        if '/wiki/' in href and 'lexicanum.com' not in href:
            a['href'] = "https://wh40k.lexicanum.com" + a['href']
        for attr in ['class', 'rel']:
            if attr in a.attrs:
                a.attrs.pop(attr)
        if '(page does not exist)' in str(a.get('title', '')):
            remove = True
        if 'title' in a.attrs:
            a.attrs.pop('title')
        if remove:
            a.unwrap()

    stripped = str(''.join(map(str, source.contents))).strip()
    for tag in ['<p>', '</p>', '<i>', '</i>', '<b>', '</b>', '<sup>', '</sup>', '</br>', '<br/>', '<br>']:
        stripped = stripped.replace(tag, '')
    # Remove footnote links like [34b]
    stripped = re.sub(r'\[[\d\w]+\]', '', stripped).strip()
    return stripped


def txtonly_source(source):
    """Get plain text from a source, collapsing whitespace."""
    if not isinstance(source, str):
        txt = source.get_text()
        txt = re.sub(r'\s\s+', ' ', txt)
        # Remove footnote markers
        txt = re.sub(r'\[[\d\w]+\]', '', txt).strip()
        return txt
    return source


def get_content_tables(soup):
    """Get all content tables, filtering out mbox notices/protection banners."""
    all_tables = soup.find_all('table')
    return [t for t in all_tables if not any(
        cls in (t.get('class') or [])
        for cls in ['mbox-notice', 'mbox-protection', 'mbox-small', 'nottemplate']
    )]


def detect_table_cols(table):
    """Detect the number of data columns in a table from the first data row."""
    rows = table.find_all('tr')
    for row in rows[1:]:  # skip header
        cells = row.find_all('td')
        if cells:
            return len(cells)
    return 0


def parse_table_headers(table):
    """
    Read the first (header) row and return a dict mapping role -> column index.
    Roles: 'text', 'lore_source', 'real_source', 'notes'
    Returns None if no header row found.
    """
    rows = table.find_all('tr')
    if not rows:
        return None
    
    header_cells = rows[0].find_all(['td', 'th'])
    if not header_cells:
        return None
    
    headers = [h.get_text().strip().lower() for h in header_cells]
    
    mapping = {}
    
    for i, h in enumerate(headers):
        if not h:
            continue
        # Quote/text column (the actual quote text)
        if h in ('quote', 'excerpt', 'passage') or 'thought for the day' in h:
            mapping['text'] = i
        # Source/real source column (book/codex reference)
        elif h == 'source':
            mapping['real_source'] = i
        # Speaker/lore source column (who said it)
        elif h in ('speaker', 'tome', 'book', 'author', 'document', 'text',
                    'individual', 'tome/text', 'speaker/note',
                    'author and respective organization'):
            mapping['lore_source'] = i
        # Notes column (contextual notes, may contain speaker info)
        elif 'note' in h or 'context' in h:
            mapping['notes'] = i
    
    return mapping if mapping else None


# ── Main Processing ───────────────────────────────────────────────────────

entries = []
now = str(datetime.now())

for qu in quote_urls:
    sys.stderr.write(f"-----------------------------\nNow scraping {qu['url']}\n")

    local_file = url_to_local_file(qu["url"])
    sys.stderr.write(f"Reading from {os.path.basename(local_file)}\n")
    with open(local_file, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    # Build footnote map for this page
    fn_text, fn_html = build_footnote_map(soup)
    if fn_text:
        sys.stderr.write(f"  Footnotes: {len(fn_text)} sources mapped\n")

    # Find unattributed section marker
    unattributed_section = soup.find('span', string=re.compile('Unattributed'))
    has_unattr = unattributed_section is not None
    if has_unattr:
        sys.stderr.write(f"  Unattributed section found\n")

    tables = get_content_tables(soup)
    sys.stderr.write(f"  Content tables: {len(tables)}\n")

    # Determine page type for special handling
    is_tftd = '/Thought_for_the_day' in qu["url"]
    is_tactica = '/Tactica_Imperium_passages' in qu["url"]

    for idx, table in enumerate(tables):
        is_last = idx == len(tables) - 1
        is_unattr = is_last and has_unattr
        table_ncols = detect_table_cols(table)
        
        # Parse header to determine column layout
        col_map = parse_table_headers(table)

        # HARDCODE: Tyranid unattributed table has wrong header
        # Header says "Quote | Speaker | Source" but data is "Speaker | Quote | Source"
        if '/Tyranid_Quotes' in qu["url"] and col_map and col_map.get('text') == 0 and col_map.get('lore_source') == 1:
            if is_last and has_unattr:
                col_map['text'] = 1
                col_map['lore_source'] = 0

        lore_source_prev_rowspan = None
        real_source_prev_rowspan = None
        lore_source_prev_rowspan_num = 0
        real_source_prev_rowspan_num = 0

        for row_idx, row in enumerate(table.find_all("tr")):
            if row_idx == 0:
                continue

            cells = row.find_all("td")
            if not cells:
                continue

            ncols = len(cells)

            if row_idx == 1:
                first_txt = cells[0].get_text().strip()[:25]
                if col_map:
                    sys.stderr.write(f"  Table {idx}: {first_txt}... ({table_ncols}col, map={col_map})\n")
                else:
                    sys.stderr.write(f"  Table {idx}: {first_txt}... ({table_ncols}col, NO HEADER MAP)\n")

            text = None
            lore_source = None
            real_source = None

            # ── Determine column layout using header map ──
            # Effective columns = actual cells + active rowspans
            effective_cols = ncols
            if lore_source_prev_rowspan_num > 0:
                effective_cols += 1
            if real_source_prev_rowspan_num > 0:
                effective_cols += 1

            if col_map and 'text' in col_map:
                # Header-based column detection (preferred)
                text_cell_idx = col_map['text']
                lore_source_cell_idx = col_map.get('lore_source', -1)
                real_source_cell_idx = col_map.get('real_source', -1)
                # notes_cell_idx = col_map.get('notes', -1)  # ignored for now
                
                # Set default lore_source if no lore column
                if lore_source_cell_idx == -1:
                    if is_tftd:
                        lore_source = "Thought for the day"
                    elif is_tactica:
                        lore_source = "Tactica Imperium"
                    else:
                        lore_source = "Unknown lore source"
                
                # Set default real_source message if no source column
                if real_source_cell_idx == -1:
                    real_source = None  # Will try footnotes later

            elif is_tftd or is_tactica:
                # 2-col: text | real_source (no lore_source)
                text_cell_idx = 0
                real_source_cell_idx = 1
                lore_source_cell_idx = -1
                lore_source = "Thought for the day" if is_tftd else "Tactica Imperium"

            elif is_unattr:
                # Unattributed section: varies by page
                if '/Eldar_Quotes' in qu["url"] or '/Tau_Quotes' in qu["url"]:
                    lore_source_cell_idx = 0
                    text_cell_idx = 1
                    real_source_cell_idx = 2
                elif ncols >= 3 or effective_cols >= 3:
                    text_cell_idx = 0
                    lore_source_cell_idx = 1
                    real_source_cell_idx = 2
                else:
                    # 2-col unattributed: text | real_source
                    text_cell_idx = 0
                    real_source_cell_idx = 1
                    lore_source_cell_idx = -1
                    lore_source = "Unknown lore source"

            elif ncols >= 3 or effective_cols >= 3:
                # Standard 3-col: lore_source | text | real_source
                lore_source_cell_idx = 0
                text_cell_idx = 1
                real_source_cell_idx = 2

            elif ncols == 2:
                # New 2-col format: lore_source | text (real_source in footnotes)
                lore_source_cell_idx = 0
                text_cell_idx = 1
                real_source_cell_idx = -1  # Will resolve from footnotes

            else:
                # 1-col or unexpected — skip
                sys.stderr.write(f"  WARN: Skipping row with {ncols} cells\n")
                continue

            # ── Handle rowspans ──
            if lore_source_prev_rowspan_num > 0:
                lore_source = lore_source_prev_rowspan
                # Shift indices down since lore_source cell is missing from this row
                if lore_source_cell_idx >= 0:
                    if text_cell_idx > lore_source_cell_idx:
                        text_cell_idx -= 1
                    if real_source_cell_idx > lore_source_cell_idx:
                        real_source_cell_idx -= 1

            if real_source_prev_rowspan_num > 0:
                real_source = real_source_prev_rowspan
                if real_source_cell_idx >= 0:
                    if text_cell_idx > real_source_cell_idx:
                        text_cell_idx -= 1
                    if lore_source_cell_idx > real_source_cell_idx:
                        lore_source_cell_idx -= 1

            # Clamp indices
            text_cell_idx = max(0, min(text_cell_idx, ncols - 1))
            if lore_source_cell_idx >= 0:
                lore_source_cell_idx = max(0, min(lore_source_cell_idx, ncols - 1))
            if real_source_cell_idx >= 0:
                real_source_cell_idx = max(0, min(real_source_cell_idx, ncols - 1))

            # ── Read fields ──
            try:
                text = ''.join(map(str, cells[text_cell_idx].find_all(string=True))).strip()
                # Remove footnote markers from text
                text = re.sub(r'\[[\d\w]+\]', '', text).strip()

                if lore_source is None:
                    if lore_source_cell_idx >= 0:
                        lore_source = cells[lore_source_cell_idx]
                    else:
                        lore_source = "Unknown lore source"

                if real_source is None:
                    if real_source_cell_idx >= 0 and real_source_cell_idx < ncols:
                        real_source = cells[real_source_cell_idx]
                    else:
                        # Try to resolve from footnotes in the text cell
                        fn_src_text, fn_src_html = resolve_footnotes(cells[text_cell_idx], fn_text, fn_html)
                        if not fn_src_text and lore_source_cell_idx >= 0 and lore_source_cell_idx < ncols:
                            # Also check lore_source cell for footnotes
                            fn_src_text, fn_src_html = resolve_footnotes(cells[lore_source_cell_idx], fn_text, fn_html)
                        if fn_src_text:
                            # Store as plain string (already resolved)
                            real_source = fn_src_text
                        else:
                            real_source = "Unknown source"

            except Exception as e:
                sys.stderr.write(f"  ERROR at row {row_idx}: {e}\n")
                sys.stderr.write(f"    ncols={ncols}, text_idx={text_cell_idx}, lore_idx={lore_source_cell_idx}, real_idx={real_source_cell_idx}\n")
                sys.stderr.write(f"    cells={[c.get_text()[:30] for c in cells]}\n")
                continue  # Skip bad rows instead of crashing

            # ── Track rowspans for next iteration ──
            if lore_source_prev_rowspan_num <= 0 and lore_source_cell_idx >= 0 and lore_source_cell_idx < ncols:
                cell = cells[lore_source_cell_idx]
                if 'rowspan' in cell.attrs:
                    lore_source_prev_rowspan = cell
                    lore_source_prev_rowspan_num = int(cell.attrs['rowspan'])
                else:
                    lore_source_prev_rowspan = None
                    lore_source_prev_rowspan_num = 0

            if real_source_prev_rowspan_num <= 0 and real_source_cell_idx >= 0 and real_source_cell_idx < ncols:
                cell = cells[real_source_cell_idx]
                if 'rowspan' in cell.attrs:
                    real_source_prev_rowspan = cell
                    real_source_prev_rowspan_num = int(cell.attrs['rowspan'])
                else:
                    real_source_prev_rowspan = None
                    real_source_prev_rowspan_num = 0

            # Decrement rowspan counters
            lore_source_prev_rowspan_num -= 1
            if lore_source_prev_rowspan_num <= 0:
                lore_source_prev_rowspan_num = 0
                lore_source_prev_rowspan = None
            real_source_prev_rowspan_num -= 1
            if real_source_prev_rowspan_num <= 0:
                real_source_prev_rowspan_num = 0
                real_source_prev_rowspan = None

            # ── Build entry ──
            if not text:
                continue

            lore_source_txtonly = txtonly_source(lore_source)
            real_source_txtonly = txtonly_source(real_source)
            lore_source_clean = cleanup_sources(lore_source)
            real_source_clean = cleanup_sources(real_source)

            text = text.replace('\n', '')
            lore_source_txtonly = lore_source_txtonly.replace('\n', '')
            real_source_txtonly = real_source_txtonly.replace('\n', '')

            entry = {
                "lore_source": lore_source_clean,
                "lore_source_txtonly": lore_source_txtonly,
                "real_source": real_source_clean,
                "real_source_txtonly": real_source_txtonly,
                "text": text,
                "tags": qu["tags"],
                "found_on": '<a href="https://wh40k.lexicanum.com/wiki/">Lexicanum</a>',
                "on": now,
                "source_page": os.path.basename(local_file),
            }
            entries.append(entry)

        sys.stderr.write(f"  After table {idx}: total quotes = {len(entries)}\n")

print(json.dumps(entries, indent=4, sort_keys=True))
sys.stderr.write(f"\nTotal quotes scraped: {len(entries)}\n")
