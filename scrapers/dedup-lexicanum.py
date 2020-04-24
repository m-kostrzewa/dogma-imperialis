import json
import string
import sys
import re

with open("out.out", "r") as input_file:
    quotes = json.load(input_file)


    for quote in quotes:
        q = quote["text"]
        q = q.lower().strip()
        q = re.sub("\s\s+" , " ", q)

        for p in string.punctuation:
            q = q.replace(p, "")

        quote["normtext"] = q


    quotes = sorted(quotes, key=lambda x: x["normtext"])

    found = 0
    i = 0
    num_quotes = len(quotes)-1

    while i < num_quotes:
        if quotes[i]["normtext"] == quotes[i+1]["normtext"]:
            quotes[i]["lore_source"] += "; " + quotes[i+1]["lore_source"]
            quotes[i]["lore_source_txtonly"] += "; " + quotes[i+1]["lore_source_txtonly"]
            quotes[i]["real_source"] += "; " + quotes[i+1]["real_source"]
            quotes[i]["real_source_txtonly"] += "; " + quotes[i+1]["real_source_txtonly"]
            quotes[i]["tags"].extend([x for x in quotes[i+1]["tags"] if x not in quotes[i]["tags"]]) # unique merge 2 arrays
            del quotes[i+1]
            num_quotes -= 1
            found += 1
        else:
            i += 1

    sys.stderr.write(f"Found and merged {found} duplicates\n")

    print(json.dumps(quotes, indent=4, sort_keys=True))

