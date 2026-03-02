import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { InstantSearch, useInfiniteHits, Configure, useInstantSearch } from 'react-instantsearch';

import Firebase, { FirebaseContext } from './components/firebase';

import CogitatorComponent from './components/cogitator.jsx';
import QuotationComponent from './components/quotation.jsx';
import ModLogin from './components/modLogin.jsx';

const algoliaClient = algoliasearch(
  import.meta.env.VITE_ALGOLIA_APP_ID,
  import.meta.env.VITE_ALGOLIA_SEARCH_KEY,
);

const ESTIMATED_TOTAL_HITS = 800;
const randomOffset = Math.floor(Math.random() * ESTIMATED_TOTAL_HITS);

// --- Semantic search config ---
const SEMANTIC_SEARCH_URL = 'https://europe-west3-dogma-imperialis.cloudfunctions.net/semanticSearch';
const MIN_SEMANTIC_QUERY_LENGTH = 4;

// Cross-page dedup: tracks objectIDs already shown. Resets on page 0.
const seenObjectIDs = new Set();

/**
 * Reciprocal Rank Fusion — merge two ranked hit lists by objectID.
 * k=60 is the standard RRF constant from the original paper.
 */
function rrfMerge(algoliaHits, semanticHits, query, k = 60) {
  const scores = new Map();
  const hitMap = new Map();
  const algoliaIDs = new Set();

  // Extract significant query words (≥3 chars) for keyword-in-text check
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);

  algoliaHits.forEach((hit, i) => {
    const id = hit.objectID;
    scores.set(id, (scores.get(id) || 0) + 1 / (k + i + 1));
    hitMap.set(id, hit); // Algolia hit has full data + _highlightResult
    algoliaIDs.add(id);
  });

  semanticHits.forEach((hit, i) => {
    const id = hit.objectID;
    scores.set(id, (scores.get(id) || 0) + 1 / (k + i + 1));
    if (!hitMap.has(id)) {
      hitMap.set(id, hit);
    }
  });

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => {
      const hit = hitMap.get(id);
      if (algoliaIDs.has(id)) return hit;
      // If any query word appears in the hit text, it's a keyword match — no badge
      const textLower = (hit.text || '').toLowerCase();
      const hasKeyword = queryWords.some((w) => textLower.includes(w));
      return hasKeyword ? hit : { ...hit, _semantic: true };
    });
}

const searchClient = {
  ...algoliaClient,
  async search(requests, ...rest) {
    const mainReq = requests[0];
    const query = mainReq?.params?.query;
    const page = mainReq?.params?.page || 0;
    const hasFacetFilters = mainReq?.params?.facetFilters?.length > 0;
    const isEmptyQuery = !query && !hasFacetFilters;

    // Existing random-offset logic for empty queries
    const modified = requests.map((req) => {
      if (isEmptyQuery && (req.params?.page === 0 || req.params?.page === undefined)) {
        return {
          ...req,
          params: {
            ...req.params,
            offset: randomOffset + (req.params?.page || 0) * (req.params?.hitsPerPage || 30),
            length: req.params?.hitsPerPage || 30,
          },
        };
      }
      return req;
    });

    const shouldDoSemantic = query
      && query.length >= MIN_SEMANTIC_QUERY_LENGTH
      && page === 0
      && !hasFacetFilters;

    if (shouldDoSemantic) {
      const [algoliaResponse, semanticHits] = await Promise.all([
        algoliaClient.search(modified, ...rest),
        fetch(SEMANTIC_SEARCH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: 20 }),
        })
          .then((r) => r.json())
          .then((data) => data.hits || [])
          .catch(() => []),
      ]);

      // RRF merge
      const algoliaHits = algoliaResponse.results[0].hits;
      const merged = rrfMerge(algoliaHits, semanticHits, query);

      // Reset dedup set for new query, populate with page 0 IDs
      seenObjectIDs.clear();
      merged.forEach((h) => seenObjectIDs.add(h.objectID));

      // Replace hits in the Algolia response (keeps all metadata: nbHits, facets, etc.)
      algoliaResponse.results[0].hits = merged.slice(0, mainReq.params?.hitsPerPage || 30);
      return algoliaResponse;
    }

    // Pages 1+ or no semantic: pure Algolia, dedup against page 0
    const algoliaResponse = await algoliaClient.search(modified, ...rest);

    if (page === 0) {
      // Non-semantic page 0 (short query / facet active): just track IDs
      seenObjectIDs.clear();
      algoliaResponse.results[0].hits.forEach((h) => seenObjectIDs.add(h.objectID));
    } else {
      // Dedup: remove any hit already shown on a previous page
      algoliaResponse.results[0].hits = algoliaResponse.results[0].hits.filter((h) => {
        if (seenObjectIDs.has(h.objectID)) return false;
        seenObjectIDs.add(h.objectID);
        return true;
      });
    }

    return algoliaResponse;
  },
};

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
            <Configure hitsPerPage={30} />
            <CogitatorComponent />
            <NoResultsBoundary>
              <AutoInfiniteHits />
            </NoResultsBoundary>
          </InstantSearch>
        </article>

        <footer>
          &copy; 2026 Michał Kostrzewa
          <span className="footer-sep"> · </span>
          <ModLogin />
        </footer>
      </div>
    </FirebaseContext.Provider>
  </React.StrictMode>,
);
