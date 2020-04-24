import json
import sys
import re
from datetime import datetime

import requests
from bs4 import BeautifulSoup

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

    # https://wh40k.lexicanum.com/wiki/Portal:Quotes
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

    # from https://wh40k.lexicanum.com/wiki/Category:Quotes, removed duplicate urls from Portal:Quotes
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
        "url": "https://wh40k.lexicanum.com/wiki/Tactica_Imperium_passages"
    }
]


entries = []
now = datetime.now()
now = "%s" % (now)


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

def txtonly_source(source):
    if not isinstance(source, str):
        source_txtonly = source.get_text()
        # fix spaces
        return re.sub("\s\s+" , " ", source_txtonly)
    else:
        return source


def add_entry(text, real_source, lore_source, tags):
    lore_source_txtonly = txtonly_source(lore_source)
    real_source_txtonly = txtonly_source(real_source)

    real_source = cleanup_sources(real_source)
    lore_source = cleanup_sources(lore_source)

    text = text.replace('\n', '')
    lore_source_txtonly = lore_source_txtonly.replace('\n', '')
    real_source_txtonly = real_source_txtonly.replace('\n', '')

    entry = {
        "lore_source": lore_source,
        "lore_source_txtonly": lore_source_txtonly,
        "real_source": real_source,
        "real_source_txtonly": real_source_txtonly,
        "text": text,
        "tags": tags,
        "found_on": "https://wh40k.lexicanum.com/wiki/",
        "on": now,
    }
    entries.append(entry)


for qu in quote_urls:
    sys.stderr.write(f"-----------------------------\nNow scraping {qu['url']}\n")

    r = requests.get(qu["url"])
    soup = BeautifulSoup(r.text, "html.parser")

    unattributed_section = soup.find('span', text=re.compile('Unattributed'))
    if unattributed_section is None:
        sys.stderr.write(f"Unattributed section not found {qu['url']}\n")
    sys.stderr.write(f"Unattributed section found {qu['url']}\n")


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
                if '/Eldar_Quotes' in qu["url"] or '/Tau_Quotes' in qu["url"]:
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
                        if lore_source_prev_rowspan_num > 0:
                            real_source_cell_idx = 2
                        else:
                            real_source_cell_idx = 1
                        lore_source_cell_idx=-1 #!
            else:
                if '/Tactica_Imperium_passages' in qu["url"]:
                    text_cell_idx=0
                    real_source_cell_idx=1
                    lore_source_cell_idx=-1
                    lore_source = "Tactica Imperium"
                elif '/Thought_for_the_day' in qu["url"]:
                    text_cell_idx=1
                    real_source_cell_idx=2
                    lore_source_cell_idx=-1
                    lore_source = "Thought for the day"
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
                lore_source=lore_source,
                tags=qu["tags"])

        sys.stderr.write(f"After table; current number of quotes: {len(entries)}\n")


print(json.dumps(entries, indent=4, sort_keys=True))

sys.stderr.write(f"Total number of quotes: {len(entries)}\n")
