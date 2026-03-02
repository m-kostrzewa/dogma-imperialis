// https://medium.com/@soares.rfarias/how-to-set-up-firestore-and-algolia-319fcf2c0d37

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const {
    onDocumentCreated,
    onDocumentUpdated,
    onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const { algoliasearch } = require("algoliasearch");
const { GoogleAuth } = require("google-auth-library");

initializeApp();
const db = getFirestore();

const ALGOLIA_INDEX = "prod_QUOTES";

// --- Vertex AI Embedding config ---
const PROJECT_ID = "dogma-imperialis";
const REGION = "europe-west3";
const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIM = 768;
const VERTEX_EMBED_URL =
    `https://${REGION}-aiplatform.googleapis.com/v1/` +
    `projects/${PROJECT_ID}/locations/${REGION}/` +
    `publishers/google/models/${EMBEDDING_MODEL}:predict`;

let _auth = null;
function getAuth() {
    if (!_auth) {
        _auth = new GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
    }
    return _auth;
}

/**
 * Compute a 768-dim embedding for the given text via Vertex AI.
 * Returns a float array, or null on failure.
 */
async function computeEmbedding(text) {
    if (!text) return null;
    const client = await getAuth().getClient();
    const token = await client.getAccessToken();

    const response = await fetch(VERTEX_EMBED_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            instances: [{ content: text }],
            parameters: { outputDimensionality: EMBEDDING_DIM },
        }),
    });

    if (!response.ok) {
        console.error("Embedding API error:", response.status, await response.text());
        return null;
    }

    const data = await response.json();
    return data.predictions?.[0]?.embeddings?.values ?? null;
}

let _algoliaClient = null;
function getAlgoliaClient() {
    if (!_algoliaClient) {
        _algoliaClient = algoliasearch(
            process.env.ALGOLIA_APP_ID,
            process.env.ALGOLIA_API_KEY
        );
    }
    return _algoliaClient;
}

exports.sendCollectionToAlgolia = onRequest(
    { timeoutSeconds: 540 },
    async (req, res) => {
        const algoliaRecords = [];
        const querySnapshot = await db.collection("quotes").get();

        let currDocIdx = 0;
        querySnapshot.docs.forEach((doc) => {
            const document = doc.data();
            const record = {
                objectID: doc.id,
                text: document.text,
                lore_source: document.lore_source,
                real_source: document.real_source,
                tags: document.tags,
                found_on: document.found_on,
                on: document.on,
            };

            algoliaRecords.push(record);

            currDocIdx += 1;
            if (currDocIdx % 100 === 0) {
                console.log("Current doc id: ", currDocIdx);
            }
        });

        await getAlgoliaClient().saveObjects({
            indexName: ALGOLIA_INDEX,
            objects: algoliaRecords,
        });
        res.status(200).end();
    }
);

exports.collectionOnCreate = onDocumentCreated(
    "quotes/{uid}",
    async (event) => {
        const snapshot = event.data;
        await saveDocumentInAlgolia(snapshot);
        // Compute and store embedding
        const text = snapshot.data()?.text;
        if (text) {
            const vector = await computeEmbedding(text);
            if (vector) {
                await snapshot.ref.update({
                    embedding: FieldValue.vector(vector),
                });
            }
        }
    }
);

exports.collectionOnUpdate = onDocumentUpdated(
    "quotes/{uid}",
    async (event) => {
        const after = event.data.after;
        await saveDocumentInAlgolia(after);
        // Recompute embedding if text changed
        const before = event.data.before;
        const newText = after.data()?.text;
        const oldText = before.data()?.text;
        if (newText && newText !== oldText) {
            const vector = await computeEmbedding(newText);
            if (vector) {
                await after.ref.update({
                    embedding: FieldValue.vector(vector),
                });
            }
        }
    }
);

exports.collectionOnDelete = onDocumentDeleted(
    "quotes/{uid}",
    async (event) => {
        const snapshot = event.data;
        await deleteDocumentFromAlgolia(snapshot);
    }
);

async function saveDocumentInAlgolia(snapshot) {
    if (snapshot.exists) {
        const record = {
            objectID: snapshot.id,
            text: snapshot.data().text,
            lore_source: snapshot.data().lore_source,
            real_source: snapshot.data().real_source,
            tags: snapshot.data().tags,
            found_on: snapshot.data().found_on,
            on: snapshot.data().on,
        };
        await getAlgoliaClient().saveObject({
            indexName: ALGOLIA_INDEX,
            body: record,
        });
    }
}

async function deleteDocumentFromAlgolia(snapshot) {
    if (snapshot.exists) {
        const objectID = snapshot.id;
        await getAlgoliaClient().deleteObject({
            indexName: ALGOLIA_INDEX,
            objectID,
        });
    }
}

// --- Semantic Search Cloud Function ---

const ALLOWED_ORIGINS = [
    "https://dogma-imperialis.com",
    "https://www.dogma-imperialis.com",
    "http://localhost:5173", // Vite dev server
];

exports.semanticSearch = onRequest(
    { region: REGION, cors: ALLOWED_ORIGINS },
    async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }

        const { query, limit = 20 } = req.body || {};

        if (!query || typeof query !== "string" || query.trim().length === 0) {
            res.status(400).json({ error: "Missing or empty 'query' string" });
            return;
        }

        const clampedLimit = Math.max(1, Math.min(50, Number(limit) || 20));

        try {
            // 1. Embed the query
            const vector = await computeEmbedding(query.trim());
            if (!vector) {
                res.status(500).json({ error: "Failed to compute embedding" });
                return;
            }

            // 2. Firestore vector search (cosine distance ≤ 0.35 ≈ similarity ≥ 0.65)
            const snapshot = await db.collection("quotes")
                .findNearest({
                    vectorField: "embedding",
                    queryVector: vector,
                    limit: clampedLimit,
                    distanceMeasure: "COSINE",
                    distanceThreshold: 0.35,
                })
                .get();

            // 3. Map to Algolia-compatible hit shape
            const hits = snapshot.docs.map((doc) => {
                const d = doc.data();
                return {
                    objectID: doc.id,
                    text: d.text || "",
                    lore_source: d.lore_source || "",
                    real_source: d.real_source || "",
                    tags: d.tags || [],
                    found_on: d.found_on || "",
                };
            });

            res.status(200).json({ hits });
        } catch (err) {
            console.error("semanticSearch error:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);
