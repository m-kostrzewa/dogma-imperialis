import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import algoliasearch from 'algoliasearch/lite';
import { InstantSearch, InfiniteHits, Configure } from 'react-instantsearch-dom';
import { connectStateResults } from 'react-instantsearch/connectors';

import Firebase, { FirebaseContext } from './components/firebase';



import CogitatorComponent from './components/cogitator.js';
import QuotationComponent from './components/quotation.js';
import ModLogin from './components/modLogin.js';




const searchClient = algoliasearch(
  'YYX0J9QPH2',
  '7d0acf207476e6e99fb6caea9b526637',
);

const Results = connectStateResults(
  ({ searchState, searchResults, children }) => (searchResults && searchResults.nbHits !== 0 ? (
    children
  ) : (
    <div class="no-results">No results found</div>
  )),
);



ReactDOM.render(
  <React.StrictMode>
    <FirebaseContext.Provider value={new Firebase()}>
      <div id="page-container">

      <img class="mobile-hide" id="skull" src="czacha.png" />

        <article id="content-wrap">
          <InstantSearch
            indexName="prod_QUOTES"
            searchClient={searchClient}
          >
            <Configure
                hitsPerPage={10}
            />
            <CogitatorComponent />
            <Results>
              {/* <FirebaseContext.Consumer> */}
                <InfiniteHits hitComponent={QuotationComponent} />
              {/* </FirebaseContext.Consumer> */}
            </Results>
          </InstantSearch>

        </article>
        <footer>
            © 2020 Michał Kostrzewa
            <br/>contact: dogma dash imperialis at michal dash kostrzewa dot com
            <ModLogin />
        </footer>
      </div>
    </FirebaseContext.Provider>
  </React.StrictMode>,
  document.getElementById('root'),
);
