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

        <img class="mobile-hide" id="skull" src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/clans/11027763/1b71819403d5c8c398f62e6d888703853ec24cd2.png" />

        <article id="content-wrap">
                   {/* <FirebaseContext.Consumer>
              {firebase => <QuotationsComponent firebase={firebase} />}
          </FirebaseContext.Consumer> */}


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
            <ModLogin />
        </footer>
      </div>
    </FirebaseContext.Provider>
  </React.StrictMode>,
  document.getElementById('root'),
);
