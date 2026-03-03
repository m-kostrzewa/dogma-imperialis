import React, { useMemo, useState } from 'react';
import debounce from 'debounce';
import { useSearchBox, useInstantSearch } from 'react-instantsearch';
import { searchMode, notifyModeChanged } from '../searchMode';

function smoothScrollTo(targetY, duration) {
  const startY = window.scrollY;
  const diff = targetY - startY;
  let startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const ease = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    window.scrollTo(0, startY + diff * ease);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Debounce InstantSearch to save on billing.
// Based on:
// https://discourse.algolia.com/t/how-to-create-a-debounced-searchbox/1726/4
function DebouncedSearchBox() {
  const { refine } = useSearchBox();
  const { results } = useInstantSearch();
  const [textEnabled, setTextEnabled] = useState(searchMode.text);
  const [semanticEnabled, setSemanticEnabled] = useState(searchMode.semantic);

  const nbHits = results?.nbHits;
  const placeholder = nbHits != null
    ? `Search (${nbHits.toLocaleString()} quotes)`
    : 'Search';

  const debouncedRefine = useMemo(
    () => debounce((value) => refine(value), 500),
    [refine]
  );

  const onChange = (e) => {
    debouncedRefine(e.target.value);
  };

  const onFocus = () => {
    const anchor = document.getElementById('cogitator-anchor');
    if (anchor) {
      const targetY = anchor.getBoundingClientRect().top + window.scrollY;
      smoothScrollTo(targetY, 1200);
    }
  };

  const handleTextChange = () => {
    if (textEnabled && !semanticEnabled) return; // keep at least one
    const next = !textEnabled;
    setTextEnabled(next);
    searchMode.text = next;
    notifyModeChanged();
  };

  const handleSemanticChange = () => {
    if (!textEnabled && semanticEnabled) return; // keep at least one
    const next = !semanticEnabled;
    setSemanticEnabled(next);
    searchMode.semantic = next;
    notifyModeChanged();
  };

  return (
    <div className="main-search-div">
      <input id="mainSearch" placeholder={placeholder} type="search" onChange={onChange} onFocus={onFocus} />
      <div className="search-mode-toggle">
        <label className={`search-mode-label${textEnabled ? ' active' : ''}`}>
          <input type="checkbox" checked={textEnabled} onChange={handleTextChange} />
          <span className="search-mode-check" />
          Text
        </label>
        <label className={`search-mode-label${semanticEnabled ? ' active' : ''}`}>
          <input type="checkbox" checked={semanticEnabled} onChange={handleSemanticChange} />
          <span className="search-mode-check" />
          Meaning
        </label>
      </div>
    </div>
  );
}

export default DebouncedSearchBox;
