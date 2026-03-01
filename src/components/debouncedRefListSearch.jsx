import React, { useMemo } from 'react';
import debounce from 'debounce';
import { useRefinementList } from 'react-instantsearch';

// Debounce search, similarly to normal searchbox.
// https://www.algolia.com/doc/api-reference/widgets/refinement-list/react/#connector-param-provided-isfromsearch
function DebouncedRefinementList({ attribute, searchable }) {
  const { items, refine, searchForItems, isFromSearch } = useRefinementList({
    attribute,
    searchable,
  });

  const debouncedSearch = useMemo(
    () => debounce((value) => searchForItems(value), 500),
    [searchForItems]
  );

  const onChange = (e) => {
    debouncedSearch(e.target.value);
  };

  return (
    <div>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <span className={item.isRefined ? 'refinementActive' : 'refinementInactive'}>
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  refine(item.value);
                }}
              >
                {isFromSearch ? (
                  <span dangerouslySetInnerHTML={{ __html: item.highlighted }} />
                ) : (
                  item.label
                )}
                {' '}
                ({item.count})
              </a>
            </span>
          </li>
        ))}
        <li>
          <input
            type="search"
            placeholder="tag..."
            id="tagRefineSearch"
            onChange={onChange}
          />
        </li>
      </ul>
    </div>
  );
}

export default DebouncedRefinementList;
