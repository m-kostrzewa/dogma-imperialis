import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { InstantSearch, useInfiniteHits, Configure, useInstantSearch } from 'react-instantsearch';

import Firebase, { FirebaseContext } from './components/firebase';

import CogitatorComponent from './components/cogitator.jsx';
import QuotationComponent from './components/quotation.jsx';
import ModLogin from './components/modLogin.jsx';
import ThoughtBanner from './components/thoughtBanner.jsx';

const algoliaClient = algoliasearch(
  import.meta.env.VITE_ALGOLIA_APP_ID,
  import.meta.env.VITE_ALGOLIA_SEARCH_KEY,
);

const ESTIMATED_TOTAL_HITS = 800;
const randomOffset = Math.floor(Math.random() * ESTIMATED_TOTAL_HITS);

// --- Semantic search config ---
const SEMANTIC_SEARCH_URL = 'https://europe-west3-dogma-imperialis.cloudfunctions.net/semanticSearch';
const MIN_SEMANTIC_QUERY_LENGTH = 4;

import { searchMode, SEARCH_MODE_EVENT } from './searchMode';

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

    const canSemantic = searchMode.semantic
      && query
      && query.length >= MIN_SEMANTIC_QUERY_LENGTH
      && !hasFacetFilters;

    // Semantic-only mode, pages 1+: no more results to show
    if (canSemantic && !searchMode.text && page > 0) {
      const algoliaResponse = await algoliaClient.search(modified, ...rest);
      algoliaResponse.results[0].hits = [];
      algoliaResponse.results[0].nbHits = seenObjectIDs.size;
      algoliaResponse.results[0].nbPages = 1;
      return algoliaResponse;
    }

    if (canSemantic && page === 0) {
      const semanticPromise = fetch(SEMANTIC_SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 20 }),
      })
        .then((r) => r.json())
        .then((data) => data.hits || [])
        .catch(() => []);

      const [algoliaResponse, semanticHits] = await Promise.all([
        algoliaClient.search(modified, ...rest),
        semanticPromise,
      ]);

      if (searchMode.text) {
        // Both modes: RRF merge
        const algoliaHits = algoliaResponse.results[0].hits;
        const merged = rrfMerge(algoliaHits, semanticHits, query);

        seenObjectIDs.clear();
        merged.forEach((h) => seenObjectIDs.add(h.objectID));

        algoliaResponse.results[0].hits = merged.slice(0, mainReq.params?.hitsPerPage || 30);
      } else {
        // Semantic only: replace hits entirely with semantic results, keep badge
        seenObjectIDs.clear();
        const tagged = semanticHits.map((h) => ({ ...h, _semantic: true }));
        tagged.forEach((h) => seenObjectIDs.add(h.objectID));

        algoliaResponse.results[0].hits = tagged.slice(0, mainReq.params?.hitsPerPage || 30);
        // Tell InstantSearch there are no more pages
        algoliaResponse.results[0].nbHits = tagged.length;
        algoliaResponse.results[0].nbPages = 1;
      }
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

function slowScrollToAnchor() {
  const anchor = document.getElementById('cogitator-anchor');
  if (!anchor) return;
  const targetY = anchor.getBoundingClientRect().top + window.scrollY;
  const startY = window.scrollY;
  const diff = targetY - startY;
  let startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / 1200, 1);
    const ease = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    window.scrollTo(0, startY + diff * ease);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/**
 * Wrapper inside <InstantSearch> that listens for search-mode changes
 * and bumps a Configure param to force a fresh search.
 */
function SearchContent() {
  const [modeKey, setModeKey] = useState(0);

  useEffect(() => {
    const bump = () => setModeKey((k) => k + 1);
    window.addEventListener(SEARCH_MODE_EVENT, bump);
    return () => window.removeEventListener(SEARCH_MODE_EVENT, bump);
  }, []);

  return (
    <>
      <Configure hitsPerPage={30} analyticsTags={[`m${modeKey}`]} />
      <CogitatorComponent />
      <NoResultsBoundary>
        <AutoInfiniteHits />
      </NoResultsBoundary>
    </>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <FirebaseContext.Provider value={new Firebase()}>
      <div id="page-container">

        <img className="mobile-hide" id="skull" src="czacha.png" />

        <article id="content-wrap">
          <section className="hero-section">
            <ThoughtBanner />
            <div
              className="scroll-hint"
              onClick={() => slowScrollToAnchor()}
              aria-label="Scroll to search"
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === 'Enter' && slowScrollToAnchor()
              }
            >
              &#x25BE;
            </div>
          </section>

          <div id="cogitator-anchor" />
          <InstantSearch
            indexName="prod_QUOTES"
            searchClient={searchClient}
          >
            <SearchContent />
          </InstantSearch>
        </article>

        <footer>
          &copy; 2026 Michał Kostrzewa
          <span className="footer-sep"> · </span>
          <a href="https://github.com/m-kostrzewa/dogma-imperialis" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span className="footer-sep"> · </span>
          <ModLogin />
        </footer>
      </div>
    </FirebaseContext.Provider>
  </React.StrictMode>,
);
