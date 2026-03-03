// https://medium.com/@soares.rfarias/how-to-set-up-firestore-and-algolia-319fcf2c0d37

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated,
    onDocumentUpdated,
    onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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
                    distanceThreshold: 1.5,
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

// ================================================================
// --- Daily Thought for the Day ---
// ================================================================

const Anthropic = require("@anthropic-ai/sdk");
const { XMLParser } = require("fast-xml-parser");

const MODERATOR_UID = "gmhoL3b4R1cRajWnAYBcm4vB9oX2";

const HEADLINE_SOURCES = [
    { name: "Hacker News", type: "api", url: "https://hacker-news.firebaseio.com/v0/topstories.json" },
    { name: "BBC World News", type: "rss", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { name: "Ars Technica", type: "rss", url: "https://feeds.arstechnica.com/arstechnica/index" },
    { name: "Space.com", type: "rss", url: "https://www.space.com/feeds/all" },
];

const FALLBACK_THEMES = [
    "duty", "sacrifice", "obedience", "war", "faith",
    "technology", "betrayal", "hope", "fear", "vigilance",
];

/**
 * Fetch headlines from RSS feed, returning top items from last 24h.
 */
async function fetchRSSHeadlines(source) {
    try {
        const resp = await fetch(source.url, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const xml = await resp.text();
        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(xml);

        const channel = parsed?.rss?.channel || parsed?.feed;
        let items = channel?.item || channel?.entry || [];
        if (!Array.isArray(items)) items = [items];

        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

        return items
            .map((item) => {
                const title = item.title?.["#text"] || item.title || "";
                const pubDate = item.pubDate || item.published || item.updated || "";
                const link = item.link?.["@_href"] || item.link?.href || item.link || "";
                const url = typeof link === "string" ? link.trim() : "";
                const date = pubDate ? new Date(pubDate) : null;
                return { title: title.trim(), date, source: source.name, url };
            })
            .filter((h) => h.title && (!h.date || h.date.getTime() > oneDayAgo))
            .slice(0, 5);
    } catch (err) {
        console.warn(`Failed to fetch RSS from ${source.name}:`, err.message);
        return [];
    }
}

/**
 * Fetch top stories from Hacker News API.
 */
async function fetchHNHeadlines() {
    try {
        const resp = await fetch(HEADLINE_SOURCES[0].url, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const ids = await resp.json();
        const top30 = ids.slice(0, 30);

        const stories = await Promise.all(
            top30.map(async (id) => {
                try {
                    const r = await fetch(
                        `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
                        { signal: AbortSignal.timeout(5000) }
                    );
                    return r.ok ? r.json() : null;
                } catch {
                    return null;
                }
            })
        );

        return stories
            .filter((s) => s && s.title)
            .map((s) => ({
                title: s.title.trim(),
                date: new Date(s.time * 1000),
                source: "Hacker News",
                url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
            }))
            .slice(0, 5);
    } catch (err) {
        console.warn("Failed to fetch Hacker News:", err.message);
        return [];
    }
}

/**
 * Fetch headlines from all sources. Returns deduped list.
 */
async function fetchAllHeadlines() {
    const rssSources = HEADLINE_SOURCES.filter((s) => s.type === "rss");
    const results = await Promise.all([
        fetchHNHeadlines(),
        ...rssSources.map((s) => fetchRSSHeadlines(s)),
    ]);

    const allHeadlines = results.flat();

    // Deduplicate by title (case-insensitive)
    const seen = new Set();
    const deduped = [];
    for (const h of allHeadlines) {
        const key = h.title.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(h);
        }
    }

    return deduped;
}

/**
 * Core logic for generating a daily thought pairing.
 * @param {object} options
 * @param {boolean} options.dryRun - If true, don't write to Firestore
 * @returns {object} The generated pairing result
 */
async function runDailyThoughtGeneration({ dryRun = false } = {}) {
    // 1. Fetch headlines
    let headlines = await fetchAllHeadlines();
    let useFallback = false;

    if (headlines.length === 0) {
        // Fallback: pick random theme
        useFallback = true;
        const theme = FALLBACK_THEMES[Math.floor(Math.random() * FALLBACK_THEMES.length)];
        headlines = [{ title: theme, source: "theme", date: new Date() }];
        console.warn("All headline sources failed, using fallback theme:", theme);
    }

    // 2. Load all short quotes (≤200 chars) from Firestore
    const snapshot = await db.collection("quotes").get();
    const allCandidates = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((q) => q.text && q.text.length <= 200);

    // 3. Load recently used IDs
    const metaDoc = await db.doc("daily_thought/meta").get();
    let recentIds = metaDoc.exists ? metaDoc.data().recentIds || [] : [];

    // If too few candidates remain after exclusions, reset recent list
    const excludeSet = new Set(recentIds);
    let candidates = allCandidates.filter((q) => !excludeSet.has(q.id));
    if (candidates.length < 50) {
        console.warn("Fewer than 50 candidates after exclusions, resetting recent IDs.");
        recentIds = [];
        candidates = allCandidates;
    }

    // 4. Shuffle headlines + quotes so repeated calls get different orderings
    const shuffled = (arr) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };
    const shuffledHeadlines = shuffled(headlines);
    const shuffledCandidates = shuffled(candidates);

    // 5. Call Claude Haiku
    const headlineBlock = shuffledHeadlines
        .map((h, i) => `${i + 1}. "${h.title}" (${h.source})`)
        .join("\n");

    const quoteBlock = shuffledCandidates
        .map((q) => `${q.id} | ${q.text}`)
        .join("\n");

    const excludeBlock = recentIds.length > 0
        ? `\nDO NOT pick any of these recently used quote IDs: [${recentIds.join(", ")}]\n`
        : "";

    const systemPrompt = `You are a curator for a Warhammer 40,000 quote database. Your job is to pick the one quote that creates the most striking, ironic, or thematically resonant pairing with a real-world news headline.

Avoid pairing quotes with headlines about mass casualties, natural disasters with large death tolls, or attacks on civilians. If all headlines are sensitive, pick the most neutral available quote.`;

    const userPrompt = `TODAY'S TOP HEADLINES:
${headlineBlock}

AVAILABLE QUOTES (id | text):
${quoteBlock}
${excludeBlock}
Instructions:
- Pick exactly ONE quote that best pairs with ONE headline
- Prefer ironic, darkly humorous, or philosophically resonant pairings
- Avoid literal/obvious matches (e.g., don't match a war headline with a quote that just says "war")
- Creative, unexpected connections are better

Return ONLY valid JSON:
{
  "quoteId": "<firestore doc id>",
  "headlineIndex": <1-based index>,
  "reasoning": "<one sentence explaining the pairing>"
}`;

    const anthropic = new Anthropic();
    let selectedQuoteId = null;
    let headlineIndex = null;
    let reasoning = "";

    const candidateIdSet = new Set(candidates.map((q) => q.id));

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const msg = await anthropic.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 256,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt }],
            });

            const content = msg.content[0]?.text || "";
            // Extract JSON from response (may be wrapped in markdown code blocks)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON found in response");

            const parsed = JSON.parse(jsonMatch[0]);
            if (!parsed.quoteId || !parsed.headlineIndex) {
                throw new Error("Missing required fields in response");
            }
            if (!candidateIdSet.has(parsed.quoteId)) {
                throw new Error(`Invalid quoteId: ${parsed.quoteId}`);
            }

            selectedQuoteId = parsed.quoteId;
            headlineIndex = parsed.headlineIndex;
            reasoning = parsed.reasoning || "";
            break;
        } catch (err) {
            console.warn(`Haiku attempt ${attempt + 1} failed:`, err.message);
            if (attempt === 1) {
                // Final fallback: random quote
                console.warn("Both Haiku attempts failed, picking random quote.");
                const randomQuote = candidates[Math.floor(Math.random() * candidates.length)];
                selectedQuoteId = randomQuote.id;
                headlineIndex = 1;
                reasoning = "Random fallback — LLM unavailable";
                useFallback = true;
            } else {
                // Wait 65s before retry to clear ITPM rate-limit window
                console.warn("Waiting 65s before retry (rate-limit cooldown)...");
                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => setTimeout(r, 65000));
            }
        }
    }

    // Get full quote data
    const quoteDoc = await db.doc(`quotes/${selectedQuoteId}`).get();
    const quote = quoteDoc.data();
    const headline = shuffledHeadlines[headlineIndex - 1] || shuffledHeadlines[0];

    const todayStr = new Date().toISOString().split("T")[0];

    const result = {
        quoteId: selectedQuoteId,
        quoteText: quote.text,
        quoteLoreSource: quote.lore_source || "",
        quoteRealSource: quote.real_source || "",
        quoteTags: quote.tags || [],
        headline: useFallback && headline.source === "theme" ? "" : headline.title,
        headlineSource: useFallback && headline.source === "theme" ? "" : headline.source,
        headlineUrl: useFallback && headline.source === "theme" ? "" : (headline.url || ""),
        reasoning: reasoning,
        date: todayStr,
        model: "claude-haiku-4-5-20251001",
        createdAt: FieldValue.serverTimestamp(),
    };

    if (!dryRun) {
        // 5. Write result to Firestore
        await db.doc(`daily_thought/${todayStr}`).set(result);

        // 6. Update recent IDs
        const updatedRecent = [selectedQuoteId, ...recentIds].slice(0, 90);
        await db.doc("daily_thought/meta").set({ recentIds: updatedRecent });

        console.log(`Daily thought saved for ${todayStr}: quote=${selectedQuoteId}, headline="${headline.title}"`);
    }

    return result;
}

// --- Scheduled trigger: runs daily at 06:00 UTC ---
exports.generateDailyThought = onSchedule(
    {
        schedule: "0 6 * * *",
        timeZone: "UTC",
        region: "europe-west3",
        timeoutSeconds: 120,
        memory: "512MiB",
    },
    async () => {
        await runDailyThoughtGeneration();
    }
);

// --- Manual trigger / debug endpoint (mod-only) ---
exports.triggerDailyThought = onRequest(
    { region: "europe-west3", cors: ALLOWED_ORIGINS, memory: "1GiB", timeoutSeconds: 540 },
    async (req, res) => {
        // Verify moderator auth
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) {
            res.status(401).json({ error: "No auth token" });
            return;
        }

        const admin = require("firebase-admin");
        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(idToken);
        } catch (err) {
            res.status(401).json({ error: "Invalid auth token" });
            return;
        }

        if (decoded.uid !== MODERATOR_UID) {
            res.status(403).json({ error: "Not moderator" });
            return;
        }

        const isDryRun = req.query.dryRun === "true";
        const isSave = req.query.save === "true";

        if (isSave && req.method === "POST") {
            // Save a previously previewed pairing
            const preview = req.body;
            if (!preview || !preview.quoteId) {
                res.status(400).json({ error: "Missing preview data" });
                return;
            }
            const todayStr = new Date().toISOString().split("T")[0];
            const result = {
                quoteId: preview.quoteId,
                quoteText: preview.quoteText,
                quoteLoreSource: preview.quoteLoreSource || "",
                quoteRealSource: preview.quoteRealSource || "",
                quoteTags: preview.quoteTags || [],
                headline: preview.headline || "",
                headlineSource: preview.headlineSource || "",
                headlineUrl: preview.headlineUrl || "",
                reasoning: preview.reasoning || "",
                date: todayStr,
                model: preview.model || "manual-save",
                createdAt: FieldValue.serverTimestamp(),
            };
            await db.doc(`daily_thought/${todayStr}`).set(result);

            // Update recent IDs
            const metaDoc = await db.doc("daily_thought/meta").get();
            const recentIds = metaDoc.exists ? metaDoc.data().recentIds || [] : [];
            const updatedRecent = [preview.quoteId, ...recentIds].slice(0, 90);
            await db.doc("daily_thought/meta").set({ recentIds: updatedRecent });

            res.status(200).json(result);
            return;
        }

        if (isDryRun) {
            // Preview mode: generate without saving
            const result = await runDailyThoughtGeneration({ dryRun: true });
            res.status(200).json(result);
            return;
        }

        // Default: generate and save
        const result = await runDailyThoughtGeneration();
        res.status(200).json(result);
    }
);
