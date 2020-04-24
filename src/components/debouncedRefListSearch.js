import React from 'react';
import debounce from 'debounce';
import { connectRefinementList } from 'react-instantsearch/connectors';
import { Highlight } from 'react-instantsearch-dom';

// deoubnce search, similarly to normal searchbox.
// https://www.algolia.com/doc/api-reference/widgets/refinement-list/react/#connector-param-provided-isfromsearch
export default connectRefinementList(({
  items, isFromSearch, refine, searchForItems,
}) => {
  const debouncedSearch = debounce((e) => searchForItems(e.target.value), 500);

  const onChange = (e) => {
    e.persist();
    e.preventDefault();

    debouncedSearch(e, e.eventTarget);
  };

  return (
    <div>
        <input
            type="search"
            placeholder="filter_tags_"
            id="tagRefineSearch"
            onChange={onChange}
        />
        <ul>
        {items.map((item) => (
            <li key={item.label}>
            <span class={item.isRefined ? 'refinementActive' : 'refinementInactive'}>
                <a
                    href="#"
                    onClick={(event) => {
                    event.preventDefault();
                    refine(item.value);
                    }}
                >
                    {isFromSearch ? (
                    <Highlight attribute="label" hit={item} />
                    ) : (
                    item.label
                    )}
                    {' '}
                    (
                    {item.count}
                    )
                </a>
            </span>
            </li>
        ))}
        </ul>
    </div>
  );
});
