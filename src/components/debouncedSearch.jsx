import React, { useMemo } from 'react';
import debounce from 'debounce';
import { useSearchBox } from 'react-instantsearch';

// Debounce InstantSearch to save on billing.
// Based on:
// https://discourse.algolia.com/t/how-to-create-a-debounced-searchbox/1726/4
function DebouncedSearchBox() {
  const { refine } = useSearchBox();

  const debouncedRefine = useMemo(
    () => debounce((value) => refine(value), 500),
    [refine]
  );

  const onChange = (e) => {
    debouncedRefine(e.target.value);
  };

  return (
    <div className="main-search-div">
      <input id="mainSearch" placeholder="search" type="search" onChange={onChange} />
    </div>
  );
}

export default DebouncedSearchBox;
