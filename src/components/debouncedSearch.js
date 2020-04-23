import React from 'react';
import debounce from 'debounce';
import { connectSearchBox } from 'react-instantsearch/connectors';


// Debounce InstantSearch to save on billing.
// Based on:
//
// https://discourse.algolia.com/t/how-to-create-a-debounced-searchbox/1726/4
// https://codesandbox.io/s/Dg2Zz5Ek?file=/index.js
export default connectSearchBox(({ refine }) => {
  const debouncedSearch = debounce((e) => refine(e.target.value), 200);

  const onChange = (e) => {
    e.persist();
    debouncedSearch(e, e.eventTarget);
  };

  return (
    <div class="submenu-div">
        <span><input placeholder="query_string_" type="search" onChange={onChange} /></span>
    </div>
  );
});
