import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { InstantSearch, InfiniteHits, Configure, useInstantSearch } from 'react-instantsearch';

import Firebase, { FirebaseContext } from './components/firebase';

import CogitatorComponent from './components/cogitator.jsx';
import QuotationComponent from './components/quotation.jsx';
import ModLogin from './components/modLogin.jsx';

const searchClient = algoliasearch(
  import.meta.env.VITE_ALGOLIA_APP_ID,
  import.meta.env.VITE_ALGOLIA_SEARCH_KEY,
);

function NoResultsBoundary({ children }) {
  const { results } = useInstantSearch();
  if (results && results.nbHits === 0) {
    return <div className="no-results">No results found</div>;
  }
  return children;
}

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <FirebaseContext.Provider value={new Firebase()}>
      <div id="page-container">

        <img className="mobile-hide" id="skull" src="czacha.png" />

        <article id="content-wrap">
          <InstantSearch
            indexName="prod_QUOTES"
            searchClient={searchClient}
          >
            <Configure hitsPerPage={10} />
            <CogitatorComponent />
            <NoResultsBoundary>
              <InfiniteHits hitComponent={QuotationComponent} />
            </NoResultsBoundary>
          </InstantSearch>
        </article>

        <footer>
          &copy; 2026 Michał Kostrzewa
          <br />contact: dogma dash imperialis at michal dash kostrzewa dot com
          <ModLogin />
        </footer>
      </div>
    </FirebaseContext.Provider>
  </React.StrictMode>,
);
