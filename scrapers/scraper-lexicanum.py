import json
import sys
import re

import requests
from bs4 import BeautifulSoup

totd_urls = [
    "https://wh40k.lexicanum.com/wiki/Thought_for_the_day_(A_-_H)",
    "https://wh40k.lexicanum.com/wiki/Thought_for_the_day_(I_-_P)",
    "https://wh40k.lexicanum.com/wiki/Thought_for_the_day_(Q_-_Z)"
]

quote_urls = [
    # https://wh40k.lexicanum.com/wiki/Portal:Quotes
    "https://wh40k.lexicanum.com/wiki/Quotes_Imperium",
    "https://wh40k.lexicanum.com/wiki/Quotes_Adeptus_Mechanicus",
    "https://wh40k.lexicanum.com/wiki/Ecclesiarchy_Quotes",
    "https://wh40k.lexicanum.com/wiki/Quotes_Astra_Militarum",
    "https://wh40k.lexicanum.com/wiki/Quotes_Imperial_Navy",
    "https://wh40k.lexicanum.com/wiki/Inquisition_Quotes",
    "https://wh40k.lexicanum.com/wiki/Officio_Assassinorum_Quotes",
    "https://wh40k.lexicanum.com/wiki/Quotes_Space_Marines",
    "https://wh40k.lexicanum.com/wiki/Squat_Quotes",
    "https://wh40k.lexicanum.com/wiki/Adeptus_Arbites_Quotes",
    "https://wh40k.lexicanum.com/wiki/Quotes_Chaos",
    "https://wh40k.lexicanum.com/wiki/Eldar_Quotes",
    "https://wh40k.lexicanum.com/wiki/Ork_Quotes",
    "https://wh40k.lexicanum.com/wiki/Tau_Quotes",
    "https://wh40k.lexicanum.com/wiki/Dark_Eldar_Quotes",
    "https://wh40k.lexicanum.com/wiki/Tyranid_Quotes",

    # from https://wh40k.lexicanum.com/wiki/Category:Quotes, removed duplicate urls from Portal:Quotes
    "https://wh40k.lexicanum.com/wiki/Adepta_Sororitas_Quotes",
    "https://wh40k.lexicanum.com/wiki/Adeptus_Custodes_Quotes",
    "https://wh40k.lexicanum.com/wiki/Cult_Mechanicus_Religious_Excerpts",
    "https://wh40k.lexicanum.com/wiki/Necron_Quotes",
    "https://wh40k.lexicanum.com/wiki/Tactica_Imperium_passages"


]


entries = []

def cleanup_sources(source):
    if isinstance(source, str):
        return source

    for a in source.find_all('a'):

        remove = False
        if '/wiki/' in str(a.get('href')) and not 'lexicanum.com' in str(a.get('href')): # protect against rowspan recursion
            a['href'] = "https://wh40k.lexicanum.com" + a['href']
        if 'class' in a.attrs:
            a.attrs.pop('class')
        if 'rel' in a.attrs:
            a.attrs.pop('rel')
        if '(page does not exist)' in str(a.get('title')):
            remove = True
        if 'title' in a.attrs:
            a.attrs.pop('title')
        if remove:
            a.unwrap()

    stripped = str(''.join(map(str, source.contents))).strip()
    stripped = stripped.replace('\n', '')
    stripped = stripped.replace('<p>', '')
    stripped = stripped.replace('</p>', '')
    stripped = stripped.replace('<i>', '')
    stripped = stripped.replace('</i>', '')
    stripped = stripped.replace('<b>', '')
    stripped = stripped.replace('</b>', '')
    stripped = stripped.replace('<sup>', '')
    stripped = stripped.replace('</sup>', '')
    stripped = stripped.replace('</br>', '')
    stripped = stripped.replace('<br/>', '')

    return stripped



def add_entry(text, real_source, lore_source):
    real_source = cleanup_sources(real_source)
    lore_source = cleanup_sources(lore_source)

    text = text.replace('\n', '')

    entry = {
        "lore_source": lore_source,
        "real_source": real_source,
        "text": text,
    }
    entries.append(entry)


for url in totd_urls:
    sys.stderr.write(f"-----------------------------\nNow scraping {url}\n")

    r = requests.get(url)
    soup = BeautifulSoup(r.text, "html.parser")

    tables = soup.find_all("table")
    for table in tables:
        if table is None: continue

        is_first_row = True
        for row in table.find_all("tr"):
            if is_first_row:
                is_first_row = False
                continue

            cells = row.find_all("td")
            if len(cells) != 3: continue

            _ = cells[0]
            text = str(cells[1].find(text=True)).strip()
            source = cells[2]

            add_entry(
                text=text,
                real_source=source,
                lore_source="Thought for the day")

    sys.stderr.write(f"Current number quotes: {len(entries)}\n")



for url in quote_urls:
    sys.stderr.write(f"-----------------------------\nNow scraping {url}\n")

    r = requests.get(url)
    soup = BeautifulSoup(r.text, "html.parser")

    unattributed_section = soup.find('span', text=re.compile('Unattributed'))
    if unattributed_section is None:
        sys.stderr.write(f"Unattributed section not found {url}\n")
    sys.stderr.write(f"Unattributed section found {url}\n")


    tables = soup.find_all("table")

    for idx, table in enumerate(tables):
        if table is None: continue

        is_last = idx == len(tables) - 1
        is_unattr = is_last and unattributed_section is not None

        lore_source_prev_rowspan = None
        real_source_prev_rowspan = None
        lore_source_prev_rowspan_num = 0
        real_source_prev_rowspan_num = 0


        for row_idx, row in enumerate(table.find_all("tr")):
            if row_idx == 0:
                continue

            cells = row.find_all("td")
            # sys.stderr.write(f"{cells}\n")

            if row_idx == 1:
                sys.stderr.write(f"Table start: {str(cells[0].find(text=True)).strip()[0:20]}\n")

            text = None
            lore_source = None
            real_source = None

            if is_unattr:
                if '/Eldar_Quotes' in url or '/Tau_Quotes' in url:
                    # Care! should not include Dark_Eldar_Quotes here.
                    lore_source_cell_idx=0
                    text_cell_idx=1
                    real_source_cell_idx=2
                else:
                    if len(cells) == 3:
                        text_cell_idx=0
                        lore_source_cell_idx=1
                        real_source_cell_idx=2
                    elif len(cells) == 2:
                        text_cell_idx=0
                        real_source_cell_idx=1
                        lore_source_cell_idx=-1 #!
            else:
                if '/Tactica_Imperium_passages' in url:
                    text_cell_idx=0
                    real_source_cell_idx=1
                    lore_source_cell_idx=-1
                    lore_source = "Tactica Imperium"
                else:
                    lore_source_cell_idx=0
                    text_cell_idx=1
                    real_source_cell_idx=2


            # Handle rowspans:
            if lore_source_prev_rowspan_num > 0:
                lore_source = lore_source_prev_rowspan
                if text_cell_idx > lore_source_cell_idx:
                    text_cell_idx -= 1
                    if text_cell_idx < 0: text_cell_idx = 0
                if real_source_cell_idx > lore_source_cell_idx:
                    real_source_cell_idx -= 1
                    if real_source_cell_idx < 0: real_source_cell_idx = 0

            if real_source_prev_rowspan_num > 0:
                real_source = real_source_prev_rowspan
                if text_cell_idx > real_source_cell_idx:
                    text_cell_idx -= 1
                    if text_cell_idx < 0: text_cell_idx = 0
                if lore_source_cell_idx > real_source_cell_idx:
                    lore_source_cell_idx -= 1
                    if lore_source_cell_idx < 0: lore_source_cell_idx = 0

            # Read fields
            try:
                if lore_source is None:
                    if lore_source_cell_idx != -1:
                        lore_source = cells[lore_source_cell_idx]
                    else:
                        lore_source = "Unknown lore source"
                if real_source is None:
                    real_source = cells[real_source_cell_idx]

                text = ''.join(map(str, cells[text_cell_idx].find_all(text=True))).strip()

            except Exception as e:
                sys.stderr.write(f"text_cell_idx = {text_cell_idx}\n")
                sys.stderr.write(f"lore_source_cell_idx = {lore_source_cell_idx}\n")
                sys.stderr.write(f"real_source_cell_idx = {real_source_cell_idx}\n")
                sys.stderr.write(f"cells = {cells}\n")
                sys.stderr.write(f"real_source_prev_rowspan_num = {real_source_prev_rowspan_num}\n")
                sys.stderr.write(f"lore_source_prev_rowspan_num = {lore_source_prev_rowspan_num}\n")
                print(json.dumps(entries, indent=4, sort_keys=True))
                raise e


            # sometimes there is a rowspan. If so, remember it for subsequent rows.
            if lore_source_prev_rowspan_num == 0:
                if 'rowspan' in cells[lore_source_cell_idx].attrs:
                    lore_source_prev_rowspan = cells[lore_source_cell_idx]
                    lore_source_prev_rowspan_num = int(cells[lore_source_cell_idx].attrs['rowspan'])
                    # sys.stderr.write(f"rs found lore_source_prev_rowspan_num{lore_source_prev_rowspan_num}\n")
                else:
                    lore_source_prev_rowspan = None
                    lore_source_prev_rowspan_num = 0
                    # sys.stderr.write(f"zero lore_source_prev_rowspan_num{lore_source_prev_rowspan_num}\n")

            if real_source_prev_rowspan_num == 0:
                if 'rowspan' in cells[real_source_cell_idx].attrs:
                    real_source_prev_rowspan = cells[real_source_cell_idx]
                    real_source_prev_rowspan_num = int(cells[real_source_cell_idx].attrs['rowspan'])
                    # sys.stderr.write(f"rs found real_source_prev_rowspan_num{real_source_prev_rowspan_num}\n")
                else:
                    real_source_prev_rowspan = None
                    real_source_prev_rowspan_num = 0
                    # sys.stderr.write(f"zero real_source_prev_rowspan_num{real_source_prev_rowspan_num}\n")

            # Handle next row for purpose of rowspans
            lore_source_prev_rowspan_num -= 1
            if lore_source_prev_rowspan_num <= 0:
                lore_source_prev_rowspan_num = 0
                lore_source_prev_rowspan = None
            real_source_prev_rowspan_num -= 1
            if real_source_prev_rowspan_num <= 0:
                real_source_prev_rowspan_num = 0
                real_source_prev_rowspan = None

            # Oof!
            add_entry(
                text=text,
                real_source=real_source,
                lore_source=lore_source)

        sys.stderr.write(f"After table; current number of quotes: {len(entries)}\n")


print(json.dumps(entries, indent=4, sort_keys=True))

sys.stderr.write(f"Total number of quotes: {len(entries)}\n")
