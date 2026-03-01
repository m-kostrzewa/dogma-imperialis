import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { InstantSearch, useInfiniteHits, Configure, useInstantSearch } from 'react-instantsearch';

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

function AutoInfiniteHits() {
  const { hits, showMore, isLastPage } = useInfiniteHits();
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isLastPage) {
          showMore();
        }
      });
    });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [showMore, isLastPage]);

  return (
    <div className="ais-InfiniteHits">
      <ul className="ais-InfiniteHits-list">
        {hits.map((hit) => (
          <li key={hit.objectID} className="ais-InfiniteHits-item">
            <QuotationComponent hit={hit} />
          </li>
        ))}
      </ul>
      <div ref={sentinelRef} style={{ height: '1px' }} />
    </div>
  );
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
              <AutoInfiniteHits />
            </NoResultsBoundary>
          </InstantSearch>
        </article>

        <footer>
          &copy; 2026 Michał Kostrzewa
          <br />contact: contact at michal dash kostrzewa dot com
          <ModLogin />
        </footer>
      </div>
    </FirebaseContext.Provider>
  </React.StrictMode>,
);
