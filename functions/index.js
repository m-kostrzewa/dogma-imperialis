// https://medium.com/@soares.rfarias/how-to-set-up-firestore-and-algolia-319fcf2c0d37

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const {
    onDocumentCreated,
    onDocumentUpdated,
    onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const { algoliasearch } = require("algoliasearch");

initializeApp();
const db = getFirestore();

const ALGOLIA_INDEX = "prod_QUOTES";

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
    }
);

exports.collectionOnUpdate = onDocumentUpdated(
    "quotes/{uid}",
    async (event) => {
        const after = event.data.after;
        await saveDocumentInAlgolia(after);
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
