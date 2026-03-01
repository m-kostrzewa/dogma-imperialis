import React from 'react';
import { useRefinementList } from 'react-instantsearch';

function DebouncedRefinementList({ attribute }) {
  const { items, refine } = useRefinementList({
    attribute,
    sortBy: ['name:asc'],
    limit: 1000,
  });

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
                {item.label} ({item.count})
              </a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DebouncedRefinementList;
