// https://medium.com/@soares.rfarias/how-to-set-up-firestore-and-algolia-319fcf2c0d37

var functions = require('firebase-functions');
var admin = require('firebase-admin');
var algoliasearch = require('algoliasearch');

admin.initializeApp();
const db = admin.firestore();

const algoliaClient = algoliasearch(functions.config().algolia.appid, functions.config().algolia.apikey);

const collectionIndex = algoliaClient.initIndex("prod_QUOTES");


const longTimeoutRuntimeOpts = {
    timeoutSeconds: 540,
}

exports.sendCollectionToAlgolia = functions
    .runWith(longTimeoutRuntimeOpts)
    .https.onRequest(async (req, res) => {

    const algoliaRecords = [];

    const querySnapshot = await db.collection('quotes').get();

    var currDocIdx = 0;
    querySnapshot.docs.forEach(doc => {
        const document = doc.data();
        const record = {
            objectID: doc.id,
            text: document.text,
            // TODO: escape any links in lore_source in real_source
            lore_source: document.lore_source,
            real_source: document.real_source,
            tags: document.tags,
            found_on: document.found_on,
            on: document.on,
        };

        algoliaRecords.push(record);

        currDocIdx += 1;
        if(currDocIdx % 100 === 0) {
            console.log("Current doc id: ", currDocIdx);
        }
    });

    collectionIndex.saveObjects(algoliaRecords);
    res.status(200).send("Docs indexed to Algolia successfully: ", currDocIdx);
})

exports.collectionOnCreate = functions.firestore.document('quotes/{uid}').onCreate(async (snapshot, context) => {
    await saveDocumentInAlgolia(snapshot);
});

exports.collectionOnUpdate = functions.firestore.document('quotes/{uid}').onUpdate(async (change, context) => {
    await updateDocumentInAlgolia(change);
});

exports.collectionOnDelete = functions.firestore.document('quotes/{uid}').onDelete(async (snapshot, context) => {
    await deleteDocumentFromAlgolia(snapshot);
});

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
        await collectionIndex.saveObject(record);
    }
}

async function updateDocumentInAlgolia(change) {
    const docAfterChange = change.after.data()
    await saveDocumentInAlgolia(change.after);
}

async function deleteDocumentFromAlgolia(snapshot) {
    if (snapshot.exists) {
        const objectID = snapshot.id;
        await collectionIndex.deleteObject(objectID);
    }
}


