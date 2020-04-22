// https://medium.com/@soares.rfarias/how-to-set-up-firestore-and-algolia-319fcf2c0d37

var functions = require('firebase-functions');
var admin = require('firebase-admin');
var algoliasearch = require('algoliasearch');

admin.initializeApp();
const db = admin.firestore();

const algoliaClient = algoliasearch(functions.config().algolia.appid, functions.config().algolia.apikey);

const collectionIndex = algoliaClient.initIndex("prod_QUOTES");


const longTimeoutRuntimeOpts = {
    timeoutSeconds: 300,
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
			real_source: document.real_source
        };

        algoliaRecords.push(record);

        currDocIdx += 1;
        if(currDocIdx % 10 === 0) {
            console.log("Current doc id: ", currDocIdx);
        }
    });

	collectionIndex.saveObjects(algoliaRecords, (_error, content) => {
        res.status(200).send("Docs indexed to Algolia successfully: ", currDocIdx);
    });
})

