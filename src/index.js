import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import algoliasearch from 'algoliasearch/lite';
import { InstantSearch, InfiniteHits } from 'react-instantsearch-dom';
import { connectStateResults } from 'react-instantsearch/connectors';

import CogitatorComponent from './components/cogitator.js';
import QuotationComponent from './components/quotation.js';


import Firebase, { FirebaseContext } from './components/firebase';


const searchClient = algoliasearch(
  'YYX0J9QPH2',
  '7d0acf207476e6e99fb6caea9b526637',
);

const Results = connectStateResults(
  ({ searchState, searchResults, children }) => (searchResults && searchResults.nbHits !== 0 ? (
    children
  ) : (
    <div class="no-results">no_results_found_</div>
  )),
);


ReactDOM.render(
  <React.StrictMode>
    <FirebaseContext.Provider value={new Firebase()}>
      <div id="page-container">
        {/* <nav>
          <a href="#home">Home</a>
          <a href="#contact">Contact</a>
        </nav> */}

        <img id="skull" src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/clans/11027763/1b71819403d5c8c398f62e6d888703853ec24cd2.png" />

        <article id="content-wrap">
          {/*          <FirebaseContext.Consumer>
              {firebase => <QuotationsComponent firebase={firebase} />}
          </FirebaseContext.Consumer> */}


          <InstantSearch
            indexName="prod_QUOTES"
            searchClient={searchClient}
          >
            <CogitatorComponent />
            <Results>
              <InfiniteHits hitComponent={QuotationComponent} />
            </Results>
          </InstantSearch>

        </article>
        <footer>
            © 2020 Michał Kostrzewa
        </footer>
      </div>
    </FirebaseContext.Provider>
  </React.StrictMode>,
  document.getElementById('root'),
);
