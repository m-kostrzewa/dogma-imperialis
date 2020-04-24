import json
import random
import glob

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

# Use a service account
cred = credentials.Certificate('/home/kosiak/Documents/dogmatis-imperialis-service-account/dogma-imperialis-555b2398ff60.json')
firebase_admin.initialize_app(cred)

db = firestore.client()

quotes_col_ref = db.collection(u'quotes')

# print("Deleting previous")
# read_quotes = quotes_col_ref.stream()
# for read_quote in read_quotes:
#     read_quote.reference.delete()


for filepath in glob.glob('data/*.txt'):
    print(f"Uploading from {filepath}")

    with open(filepath, "r") as input_file:
        quotes = json.load(input_file)

        # for test
        # random.shuffle(quotes)
        for i, quote in enumerate(quotes):
            if i % 50 == 0:
                print(f"{i / len(quotes)}")
            quotes_col_ref.add(quote)

    # read_quotes = quotes_col_ref.stream()
    # for read_quote in read_quotes:
    #     print(f'{read_quote.id} => {read_quote.to_dict()}')
        # read_quote.reference.delete()

# mind_related = quotes_col_ref.where()
# for mr in mrs:
#     print(f'{mr.id} => {mr.to_dict()}')

