"""
Export all quotes from Firestore to a local JSON file.
Preserves document IDs for merge/diff purposes.
"""
import json
import os
import firebase_admin
from firebase_admin import credentials, firestore

# Service account in repo root
SERVICE_ACCOUNT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'dogma-imperialis-8ae6710edfe8.json'
)

cred = credentials.Certificate(SERVICE_ACCOUNT)
firebase_admin.initialize_app(cred)
db = firestore.client()

print("Exporting quotes from Firestore...", flush=True)
quotes = []
for doc in db.collection('quotes').stream():
    data = doc.to_dict()
    data['_firestore_id'] = doc.id
    quotes.append(data)

print(f"Exported {len(quotes)} quotes")

# Save with UTF-8
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firestore_export.json')
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(quotes, f, indent=2, ensure_ascii=False, default=str)

print(f"Saved to {output_path}")
