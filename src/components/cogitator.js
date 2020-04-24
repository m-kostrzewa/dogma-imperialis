import React from 'react';

import { RefinementList } from 'react-instantsearch-dom';

import DebouncedSearchBox from './debouncedSearch';
import DebouncedRefinementList from './debouncedRefListSearch';

import './cogitator.css';


class CogitatorComponent extends React.Component {

    render() {
        return (
        <div class="cogitator">
            <DebouncedSearchBox />
            <DebouncedRefinementList attribute="tags" searchable/>
        </div>
      );
    }
}

export default CogitatorComponent;
