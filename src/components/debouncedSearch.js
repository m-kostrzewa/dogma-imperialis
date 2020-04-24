import React from 'react';
import debounce from 'debounce';
import { connectSearchBox } from 'react-instantsearch/connectors';


// Debounce InstantSearch to save on billing.
// Based on:
//
// https://discourse.algolia.com/t/how-to-create-a-debounced-searchbox/1726/4
// https://codesandbox.io/s/Dg2Zz5Ek?file=/index.js
export default connectSearchBox(({ refine }) => {
  const debouncedSearch = debounce((e) => refine(e.target.value), 500);

  const onChange = (e) => {
    e.persist();
    e.preventDefault();

    debouncedSearch(e, e.eventTarget);
  };

  return (
    <div>
        <span><input id="mainSearch" placeholder="query_data_looms_" type="search" onChange={onChange} /></span>
    </div>
  );
});
